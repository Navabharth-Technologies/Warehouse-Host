import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Package, Printer, QrCode, Weight, MapPin, User, ShoppingCart, Barcode, CheckCircle } from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { Modal } from 'react-native';
import { Picker } from '@react-native-picker/picker';

export function PackageLabeling({ shipments = [], onLabel }) {
    const [selectedShipment, setSelectedShipment] = useState(null);
    const [weight, setWeight] = useState('');
    const [showPreview, setShowPreview] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentLabelNumber, setCurrentLabelNumber] = useState('');
    const [errors, setErrors] = useState({});

    const handleWeightChange = (text) => {
        setWeight(text);
        if (text) {
            setErrors(prev => ({ ...prev, weight: '' }));
        }
    };

    const collectedShipments = shipments.filter(s => s.status === 'collected' || s.status === 'at-hub');

    const handleGenerateLabel = () => {
        if (!weight) {
            Alert.alert("Missing Information", "Please enter valid weight.");
            return;
        }
        setShowPreview(true);
    };

    const handleConfirmPrint = async () => {
        const shipment = shipments.find(s => s.id === selectedShipment);
        const labelNumber = currentLabelNumber;
        const date = new Date().toLocaleDateString('en-CA');

        setIsSubmitting(true);

        try {
            // Using a more robust client-side barcode generation for the PDF
            const html = `
                <!DOCTYPE html>
                <html>
                  <head>
                    <meta charset="utf-8">
                    <title>Shipping Label - ${labelNumber}</title>
                    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
                    <style>
                      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
                      * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
                      body { font-family: 'Inter', Helvetica, Arial, sans-serif; padding: 0; margin: 0; background: #fff; width: 100%; }
                      .label-container { display: flex; justify-content: center; padding: 20px; }
                      .label-box { border: 4px solid #000; width: 450px; display: flex; flex-direction: column; background: white; }
                      .row { display: flex; border-bottom: 4px solid #000; }
                      .col { flex: 1; padding: 15px; }
                      .col.border-right { border-right: 4px solid #000; }
                      .label-title-box { background: #000; color: #fff; display: inline-block; padding: 6px 12px; font-weight: 800; font-size: 13px; text-transform: uppercase; margin-bottom: 10px; }
                      .label-caption { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 5px; }
                      .text-lg { font-size: 18px; font-weight: 800; color: #000; margin-bottom: 2px; }
                      .text-base { font-size: 14px; font-weight: 700; color: #000; }
                      .text-sm { font-size: 12px; color: #000; line-height: 1.4; font-weight: 500; }
                      .details-grid { display: flex; flex-direction: column; }
                      .details-row { display: flex; border-bottom: 1px solid #000; padding: 8px 12px; align-items: center; }
                      .details-row:last-child { border-bottom: none; }
                      .details-label { font-size: 10px; font-weight: 700; color: #64748b; width: 45%; }
                      .details-value { font-size: 13px; font-weight: 800; color: #000; flex: 1; text-align: right; }
                      .barcode-container { padding: 20px; text-align: center; border-top: 4px solid #000; background: #fff; }
                      #barcode { width: 100%; max-width: 380px; height: auto; min-height: 80px; }
                      .tracking-number { text-align: center; font-family: monospace; font-size: 13px; font-weight: 700; color: #000; margin-top: 5px; letter-spacing: 2px; }
                      
                      @media print {
                        @page { margin: 0; }
                        body { padding: 0; }
                        .label-container { padding: 0; }
                      }
                    </style>
                  </head>
                  <body>
                    <div class="label-container">
                      <div class="label-box">
                        <div class="row">
                          <div class="col border-right" style="flex: 1.2;">
                            <div class="label-title-box">SHIP TO:</div>
                            <div class="text-lg">${shipment.customerName}</div>
                            <div class="text-sm" style="margin-top: 5px;">${shipment.customerAddress}</div>
                          </div>
                          <div class="col" style="flex: 1;">
                            <div class="label-caption">FROM:</div>
                            <div class="text-base">${shipment.vendorName}</div>
                            <div class="text-sm" style="margin-top: 4px;">${shipment.vendorAddress}</div>
                          </div>
                        </div>

                        <div class="row" style="border-bottom: 0;">
                          <div class="col border-right" style="padding: 0; flex: 1.2;">
                              <div class="details-grid">
                                <div class="details-row"><div class="details-label">ORDER ID:</div><div class="details-value">${shipment.orderId}</div></div>
                                <div class="details-row"><div class="details-label">WEIGHT:</div><div class="details-value">${weight}</div></div>
                                <div class="details-row"><div class="details-label">AMOUNT:</div><div class="details-value">₹${shipment.totalAmount}</div></div>
                                <div class="details-row"><div class="details-label">DATE:</div><div class="details-value">${date}</div></div>
                              </div>
                          </div>
                          <div class="col" style="flex: 1;">
                            <div class="label-caption">REMARKS:</div>
                            <div class="text-base" style="font-size: 13px;">${(shipment.collectionNotes || shipment.notes || 'NO REMARKS').toUpperCase()}</div>
                          </div>
                        </div>

                        <div class="barcode-container">
                          <svg id="barcode"></svg>
                          <div class="tracking-number">${labelNumber}</div>
                        </div>
                      </div>
                    </div>
                    <script>
                      try {
                        JsBarcode("#barcode", "${labelNumber}", {
                          format: "CODE128",
                          width: 2.5,
                          height: 80,
                          displayValue: false,
                          margin: 0,
                          background: "#FFFFFF"
                        });
                      } catch (e) {
                        console.error("Barcode generation failed", e);
                      }
                    </script>
                  </body>
                </html>
            `;

            if (Platform.OS === 'web') {
                // On web, we want a small delay to ensure script runs and renders SVG
                const printContainer = document.createElement('iframe');
                printContainer.style.position = 'fixed';
                printContainer.style.right = '0';
                printContainer.style.bottom = '0';
                printContainer.style.width = '0';
                printContainer.style.height = '0';
                printContainer.style.border = '0';
                document.body.appendChild(printContainer);

                printContainer.contentWindow.document.write(html);
                printContainer.contentWindow.document.close();

                // Wait for the JsBarcode script to execute and render
                setTimeout(() => {
                    printContainer.contentWindow.focus();
                    printContainer.contentWindow.print();
                    setTimeout(() => {
                        document.body.removeChild(printContainer);
                    }, 1000);
                }, 500);
            } else {
                const { uri } = await Print.printToFileAsync({ html });
                await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
            }

            if (onLabel) {
                onLabel(shipment.id, {
                    labelNumber,
                    weight,
                    date,
                    moveToDistribution: false,
                    suppressAlert: true
                });
            }

            setShowPreview(false);
            setSelectedShipment(null);
            setWeight('');
            setCurrentLabelNumber('');
            Alert.alert("Success", "Label generated & saved!");

        } catch (error) {
            Alert.alert("Error", "Failed to generate label. Please try again.");
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <ScrollView style={{ flex: 1 }}>
                <View style={{ marginBottom: 24 }}>
                    <Text style={{ fontSize: 26, fontWeight: '800', color: '#F8FAFC', marginBottom: 6, letterSpacing: -0.5 }}>Package Labeling</Text>
                    <Text style={{ color: '#94A3B8', fontSize: 15 }}>Create labels for collected packages</Text>
                </View>

                {collectedShipments.length === 0 ? (
                    <Card style={{ backgroundColor: '#1e293b', borderWidth: 0, borderRadius: 24, padding: 40, alignItems: 'center' }}>
                        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(148, 163, 184, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                            <Package size={40} color="#94A3B8" />
                        </View>
                        <Text style={{ color: '#F8FAFC', fontSize: 18, fontWeight: '600' }}>No Labels Pending</Text>
                        <Text style={{ color: '#64748B', fontSize: 14, textAlign: 'center', marginTop: 8 }}>All shipments processed.</Text>
                    </Card>
                ) : (
                    <View style={{ gap: 16 }}>
                        {collectedShipments.map((shipment) => {
                            const isSelected = selectedShipment === shipment.id;
                            return (
                                <Card key={shipment.id} style={{ backgroundColor: '#1e293b', borderWidth: 0, borderRadius: 24, padding: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12 }}>
                                    <CardHeader style={{ padding: 16 }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <View>
                                                <CardTitle style={{ fontSize: 18, fontWeight: '700', color: '#F8FAFC' }}>Order #{shipment.orderId}</CardTitle>
                                                <Text style={{ color: '#94A3B8', fontSize: 14, marginTop: 4 }}>From: {shipment.vendorName}</Text>
                                            </View>
                                            <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.1)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                                                <Text style={{ color: '#E2E8F0', fontSize: 11, fontWeight: '700' }}>Ready to Label</Text>
                                            </View>
                                        </View>
                                    </CardHeader>
                                    <CardContent style={{ padding: 16, paddingTop: 0 }}>
                                        <View style={{ marginBottom: 12 }}>
                                            <Text style={{ color: '#F8FAFC', fontWeight: 'bold', marginBottom: 4 }}>Items</Text>
                                            <Text style={{ color: '#94A3B8', fontSize: 13 }} numberOfLines={2}>
                                                {shipment.items && shipment.items.length > 0
                                                    ? shipment.items.map(i => i.name).join(', ')
                                                    : '0 items'}
                                            </Text>
                                        </View>

                                        {isSelected ? (
                                            <View style={{ marginTop: 8 }}>
                                                {/* Separation Line */}
                                                <View style={{ height: 1, backgroundColor: '#334155', marginVertical: 16 }} />

                                                {/* Customer Details */}
                                                <View style={{ marginBottom: 16 }}>
                                                    <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '700', marginBottom: 4 }}>Customer Name</Text>
                                                    <Text style={{ color: '#F8FAFC', fontSize: 15, fontWeight: '600' }}>{shipment.customerName}</Text>
                                                </View>

                                                <View style={{ marginBottom: 24 }}>
                                                    <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '700', marginBottom: 4 }}>Delivery Address</Text>
                                                    <Text style={{ color: '#F8FAFC', fontSize: 15, lineHeight: 22 }}>{shipment.customerAddress}</Text>
                                                </View>

                                                {/* Inputs Row */}
                                                <View style={{ marginBottom: 24 }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                                        <Weight size={14} color="#94A3B8" />
                                                        <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '700' }}>Weight</Text>
                                                    </View>
                                                    <Input
                                                        placeholder="e.g. 500g or 1.2kg"
                                                        value={weight}
                                                        onChangeText={handleWeightChange}
                                                        keyboardType="default"
                                                        error={errors.weight}
                                                        inputStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#F8FAFC', fontWeight: '#600', height: 48 }}
                                                    />
                                                </View>

                                                {/* Actions */}
                                                <View style={{ flexDirection: 'row', gap: 12 }}>
                                                    <TouchableOpacity
                                                        onPress={handleGenerateLabel}
                                                        style={{ flex: 1, height: 52, backgroundColor: '#6D28D9', borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 10 }}
                                                    >
                                                        <QrCode size={20} color="#FFF" />
                                                        <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15 }}>Generate Label</Text>
                                                    </TouchableOpacity>

                                                    <TouchableOpacity
                                                        onPress={() => setSelectedShipment(null)}
                                                        style={{ width: 100, height: 52, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 12, justifyContent: 'center', alignItems: 'center' }}
                                                    >
                                                        <Text style={{ color: '#F8FAFC', fontWeight: '700' }}>Cancel</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        ) : (
                                            <TouchableOpacity
                                                onPress={() => {
                                                    const newLabel = `JKD-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
                                                    setSelectedShipment(shipment.id);
                                                    setWeight('');
                                                    setCurrentLabelNumber(newLabel);
                                                }}
                                                style={{ marginTop: 16, height: 44, backgroundColor: '#8B5CF6', borderRadius: 8, justifyContent: 'center', alignItems: 'center' }}
                                            >
                                                <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Create Label</Text>
                                            </TouchableOpacity>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </View>
                )}
            </ScrollView >
            {renderPreviewModal()}
        </>
    );

    function renderPreviewModal() {
        if (!showPreview || !selectedShipment) return null;
        const shipment = shipments.find(s => s.id === selectedShipment);
        if (!shipment) return null;

        const labelNumber = currentLabelNumber;
        const barcodeUrl = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(labelNumber)}&scale=2&rotate=N&includetext=false`;

        return (
            <Modal
                transparent={true}
                visible={showPreview}
                animationType="fade"
                onRequestClose={() => setShowPreview(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.9)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <View style={{ width: '100%', maxWidth: 450, backgroundColor: '#1e293b', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#334155', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20 }}>

                        {/* Modal Header */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                            <View>
                                <Text style={{ color: '#F8FAFC', fontSize: 20, fontWeight: '800', letterSpacing: -0.5 }}>Shipping Label Preview</Text>
                                <Text style={{ color: '#94A3B8', fontSize: 14 }}>Review the shipping label before confirming</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowPreview(false)} style={{ padding: 4 }}>
                                <Text style={{ color: '#94A3B8', fontSize: 20 }}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Label Preview Card (Matches HTML) */}
                        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 0, overflow: 'hidden', marginBottom: 24 }}>
                            {/* Top Section */}
                            <View style={{ flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: '#000', minHeight: 140 }}>
                                <View style={{ flex: 1.2, padding: 16, borderRightWidth: 2, borderRightColor: '#000' }}>
                                    <View style={{ backgroundColor: '#000', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, marginBottom: 12 }}>
                                        <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 14, letterSpacing: 1 }}>SHIP TO:</Text>
                                    </View>
                                    <Text style={{ fontSize: 18, fontWeight: '800', color: '#000', marginBottom: 6 }}>{shipment.customerName}</Text>
                                    <Text style={{ fontSize: 13, color: '#334155', fontWeight: '500', lineHeight: 18 }}>{shipment.customerAddress}</Text>
                                </View>
                                <View style={{ flex: 1, padding: 16 }}>
                                    <Text style={{ fontSize: 12, color: '#CBD5E1', fontWeight: '600', marginBottom: 4 }}>FROM:</Text>
                                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#000', marginBottom: 4 }}>{shipment.vendorName}</Text>
                                    <Text style={{ fontSize: 12, color: '#334155', lineHeight: 16 }}>{shipment.vendorAddress}</Text>
                                </View>
                            </View>

                            {/* Details Section */}
                            <View style={{ flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: '#000' }}>
                                {/* Grid Left */}
                                <View style={{ flex: 1.2, borderRightWidth: 2, borderRightColor: '#000' }}>
                                    {[
                                        { label: 'ORDER ID:', value: shipment.orderId },
                                        { label: 'WEIGHT:', value: weight },
                                        { label: 'AMOUNT:', value: `₹${shipment.totalAmount}` },
                                        { label: 'SHIPPING DATE:', value: new Date().toLocaleDateString('en-CA') }
                                    ].map((row, idx) => (
                                        <View key={idx} style={{ flexDirection: 'row', padding: 10, borderBottomWidth: idx === 3 ? 0 : 1, borderBottomColor: '#000', alignItems: 'center' }}>
                                            <Text style={{ flex: 1, fontSize: 10, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>{row.label}</Text>
                                            <Text style={{ fontSize: 13, fontWeight: '800', color: '#000' }}>{row.value}</Text>
                                        </View>
                                    ))}
                                </View>
                                {/* Remarks Right */}
                                <View style={{ flex: 1, padding: 16 }}>
                                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#94A3B8', marginBottom: 6 }}>REMARKS:</Text>
                                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#000' }}>{(shipment.collectionNotes || shipment.notes || 'NO REMARKS').toUpperCase()}</Text>
                                </View>
                            </View>

                            {/* Barcode Section */}
                            <View style={{ height: 120, justifyContent: 'center', alignItems: 'center', padding: 10, backgroundColor: 'white' }}>
                                <Image
                                    source={{ uri: barcodeUrl }}
                                    style={{ width: '100%', height: 90 }}
                                    resizeMode="contain"
                                />
                                <Text style={{ marginTop: 8, fontFamily: 'monospace', fontSize: 11, color: '#94A3B8', letterSpacing: 2 }}>{labelNumber}</Text>
                            </View>
                        </View>

                        {/* Modal Footer Actions */}
                        <View dataSet={{ testid: 'no-print' }} style={{ flexDirection: 'row', gap: 12 }}>
                            <TouchableOpacity
                                onPress={() => !isSubmitting && handleConfirmPrint()}
                                style={{ flex: 1, height: 48, backgroundColor: '#8B5CF6', borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8, opacity: isSubmitting ? 0.7 : 1 }}
                                disabled={isSubmitting}
                            >
                                <Printer size={18} color="#FFF" />
                                <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>
                                    {isSubmitting ? 'Saving...' : 'Confirm & Save Label'}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setShowPreview(false)}
                                style={{ paddingHorizontal: 20, height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#334155', justifyContent: 'center', alignItems: 'center' }}
                            >
                                <Text style={{ color: '#F8FAFC', fontWeight: '600' }}>Edit Details</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        );
    }
}
