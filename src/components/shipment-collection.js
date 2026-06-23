import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, ScrollView, TouchableOpacity, Alert, Image, Platform } from 'react-native';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Package, MapPin, CheckCircle, Clock, Camera, X, Phone, Download, Image as ImageIcon, User, Check } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';

const timeSlots = [
    { id: '10-1', label: '10:00 AM - 1:00 PM', shortLabel: '10-1' },
    { id: '1-4', label: '1:00 PM - 4:00 PM', shortLabel: '1-4' },
    { id: '4-7:30', label: '4:00 PM - 7:30 PM', shortLabel: '4-7:30' },
    { id: '7:30-10', label: '7:30 PM - 10:00 PM', shortLabel: '7:30-10' }
];

export function ShipmentCollection({ shipments = [], onCollect, downloadedSlots = {}, onMarkAsDownloaded }) {
    const [selectedShipment, setSelectedShipment] = useState(null);
    const [collectionNotes, setCollectionNotes] = useState('');
    const [uploadedPhotos, setUploadedPhotos] = useState([]);
    const [errors, setErrors] = useState({});

    const handleNotesChange = (text) => {
        setCollectionNotes(text);
        if (text && text.length > 500) {
            setErrors(prev => ({ ...prev, notes: 'Notes cannot exceed 500 characters' }));
        } else {
            setErrors(prev => ({ ...prev, notes: '' }));
        }
    };

    // Reset collection state when shipment changes or is closed
    useEffect(() => {
        if (!selectedShipment) {
            setCollectionNotes('');
            setUploadedPhotos([]);
        }
    }, [selectedShipment]);

    // Local state logic removed, using props

    const markAsDownloaded = (slotId, orderIds) => {
        if (onMarkAsDownloaded) {
            onMarkAsDownloaded(slotId, orderIds);
        }
    };

    // Show orders that are pending collection or in-transit as requested
    const pendingShipments = shipments.filter(s => {
        if (!s.status) return false;
        const st = s.status.trim().toLowerCase();
        return st === 'pending' || st === 'in-transit' || st === 'in transit' || st === 'intransit';
    });

    const getShipmentsByTimeSlot = (timeSlotId) => {
        return pendingShipments.filter(s => s.timeSlotId === timeSlotId);
    };

    const handleTakePhoto = () => {
        if (Platform.OS === 'web') {
            pickImage();
        } else {
            Alert.alert(
                "Upload Photo",
                "Choose an option",
                [
                    { text: "Camera", onPress: openCamera },
                    { text: "Gallery", onPress: pickImage },
                    { text: "Cancel", style: "cancel" }
                ]
            );
        }
    };

    const openCamera = async () => {
        const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
        if (permissionResult.granted === false) {
            Alert.alert("Permission to access camera is required!");
            return;
        }
        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.7,
            base64: true,
        });
        if (!result.canceled && result.assets && result.assets[0].base64) {
            const base64Data = `data:image/jpeg;base64,${result.assets[0].base64}`;
            setUploadedPhotos(prev => [...prev, base64Data]);
        }
    };

    const pickImage = async () => {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permissionResult.granted === false) {
            Alert.alert("Permission to access gallery is required!");
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.7,
            base64: true,
        });
        if (!result.canceled && result.assets && result.assets[0].base64) {
            const base64Data = `data:image/jpeg;base64,${result.assets[0].base64}`;
            setUploadedPhotos(prev => [...prev, base64Data]);
        }
    };

    const removePhoto = (index) => {
        setUploadedPhotos(prev => prev.filter((_, i) => i !== index));
    };

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleCollect = async (shipmentId) => {
        if (uploadedPhotos.length === 0) {
            const msg = "Please upload at least one collection photo to proceed.";
            if (Platform.OS === 'web') {
                window.alert(`Action Required: ${msg}`);
            } else {
                Alert.alert("Action Required", msg);
            }
            return;
        }

        if (onCollect) {
            setIsSubmitting(true);
            try {
                const success = await onCollect(shipmentId, collectionNotes, uploadedPhotos);
                if (success) {
                    setSelectedShipment(null);
                    setCollectionNotes('');
                    setUploadedPhotos([]);
                }
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    const getFreshOrders = (timeSlotId, allSlotOrders) => {
        const downloadedIds = downloadedSlots[timeSlotId] || [];
        return allSlotOrders.filter(s => !downloadedIds.includes(s.id));
    };

    const generatePDF = async (timeSlot, ordersToPrint) => {
        if (ordersToPrint.length === 0) {
            Alert.alert("No New Orders", "All orders in this slot have already been downloaded.");
            return;
        }

        // Group by Vendor
        const vendorGroups = ordersToPrint.reduce((acc, order) => {
            const vName = order.vendorName || 'Unknown Vendor';
            if (!acc[vName]) {
                acc[vName] = {
                    details: {
                        name: order.vendorName,
                        contact: order.vendorContact,
                        address: order.vendorAddress
                    },
                    orders: []
                };
            }
            acc[vName].orders.push(order);
            return acc;
        }, {});

        const htmlContent = `
            <html>
              <head>
                <style>
                  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #333; }
                  h1 { text-align: center; margin-bottom: 5px; color: #1e293b; }
                  .sub-header { text-align: center; margin-bottom: 30px; font-size: 14px; color: #64748B; }
                  
                  .vendor-group { margin-bottom: 25px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
                  .vendor-header { background-color: #f1f5f9; padding: 12px 16px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
                  .vendor-title { font-weight: 700; font-size: 16px; color: #0f172a; }
                  .vendor-meta { font-size: 12px; color: #64748B; text-align: right; }
                  
                  table { width: 100%; border-collapse: collapse; font-size: 12px; }
                  th { background-color: #fff; color: #64748B; padding: 8px 16px; text-align: left; border-bottom: 2px solid #e2e8f0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
                  td { border-bottom: 1px solid #f1f5f9; padding: 10px 16px; vertical-align: top; }
                  tr:last-child td { border-bottom: none; }
                  
                  .amount { font-weight: 700; color: #0f172a; }
                  .item-list { margin: 0; padding-left: 14px; color: #475569; }
                  .item-list li { margin-bottom: 2px; }

                  @page { size: auto; margin: 10mm; }
                </style>
              </head>
              <body>
                <h1>Collection Manifest</h1>
                <div class="sub-header">
                  <p><strong>Slot:</strong> ${timeSlot.label}</p>
                  <p>${new Date().toLocaleDateString()} &bull; ${ordersToPrint.length} New Orders</p>
                </div>

                ${Object.values(vendorGroups).map(group => `
                    <div class="vendor-group">
                        <div class="vendor-header">
                            <div class="vendor-title">${group.details.name}</div>
                            <div class="vendor-meta">
                                ${group.details.contact}<br/>
                                ${group.details.address}
                            </div>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th style="width: 15%">Order ID</th>
                                    <th style="width: 25%">Customer</th>
                                    <th style="width: 45%">Items</th>
                                    <th style="width: 15%; text-align: right">Collect</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${group.orders.map(s => `
                                    <tr>
                                        <td><strong>#${s.orderId}</strong></td>
                                        <td>
                                            <div style="font-weight: 600; color: #334155;">${s.customerName}</div>
                                            <div style="font-size: 11px; color: #94A3B8;">${s.customerAddress}</div>
                                            <div style="font-size: 11px; color: #94A3B8;">${s.customerContact}</div>
                                        </td>
                                        <td>
                                            <ul class="item-list">
                                                ${s.items.map(i => `
                                                    <li>${i.name} <span style="color: #94A3B8;">(x${(s.items.length === 1 && s.quantity) ? s.quantity : (i.qty || i.quantity)})</span></li>
                                                `).join('')}
                                            </ul>
                                        </td>
                                        <td style="text-align: right">
                                            <div class="amount">₹${s.totalAmount}</div>
                                            <div style="font-size: 10px; color: #10B981; font-weight: 600;">${s.paymentStatus || 'COD'}</div>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `).join('')}
              </body>
            </html>
        `;

        try {
            if (Platform.OS === 'web') {
                await Print.printAsync({ html: htmlContent });
            } else {
                const { uri } = await Print.printToFileAsync({ html: htmlContent });
                await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
            }
            // Mark these specific orders as downloaded (merge with existing)
            const existing = downloadedSlots[timeSlot.id] || [];
            const newIds = ordersToPrint.map(s => s.id);
            markAsDownloaded(timeSlot.id, [...new Set([...existing, ...newIds])]);
        } catch (error) {
            Alert.alert("Error", "Failed to generate PDF");
            console.error(error);
        }
    };

    return (
        <ScrollView nativeID="main-scroll" style={{ flex: 1 }}>
            {/* Header removed as per user request */}

            {pendingShipments.length === 0 ? (
                <Card style={{ backgroundColor: '#1e293b', borderWidth: 0, borderRadius: 24, padding: 40, alignItems: 'center' }}>
                    <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(148, 163, 184, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                        <Package size={40} color="#94A3B8" />
                    </View>
                    <Text style={{ color: '#F8FAFC', fontSize: 18, fontWeight: '600' }}>All Caught Up!</Text>
                    <Text style={{ color: '#64748B', fontSize: 14, textAlign: 'center', marginTop: 8 }}>No pending collections at this moment.</Text>
                </Card>
            ) : (
                <View style={{ gap: 24 }}>
                    {/* Unscheduled / New Arrivals Section */}
                    {(() => {
                        const knownSlotIds = timeSlots.map(t => t.id);
                        const unscheduled = pendingShipments.filter(s => !s.timeSlotId || !knownSlotIds.includes(s.timeSlotId));

                        if (unscheduled.length === 0) return null;

                        return (
                            <View style={{ gap: 16 }}>
                                <LinearGradient
                                    colors={['#f59e0b', '#d97706']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16, shadowColor: '#d97706', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                        <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' }}>
                                            <Package size={18} color="#FFFFFF" />
                                        </View>
                                        <View>
                                            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>{unscheduled.length} Unscheduled Orders</Text>
                                        </View>
                                    </View>

                                    {/* Added Download Button for Unscheduled Orders */}
                                    {(() => {
                                        const freshUnscheduled = getFreshOrders('unscheduled', unscheduled);
                                        const hasFresh = freshUnscheduled.length > 0;
                                        return (
                                            <TouchableOpacity
                                                onPress={() => hasFresh && generatePDF({ id: 'unscheduled', label: 'Unscheduled / New Arrivals' }, freshUnscheduled)}
                                                disabled={!hasFresh}
                                                style={{
                                                    padding: 8,
                                                    backgroundColor: hasFresh ? 'rgba(255,255,255,0.15)' : 'rgba(34, 197, 94, 0.2)',
                                                    borderRadius: 10,
                                                    opacity: hasFresh ? 1 : 0.8
                                                }}>
                                                {hasFresh ? <Download size={18} color="#FFFFFF" /> : <Check size={18} color="#22c55e" />}
                                            </TouchableOpacity>
                                        );
                                    })()}
                                </LinearGradient>

                                {unscheduled.map((shipment) => (
                                    <Card key={shipment.id} style={{ backgroundColor: '#1e293b', borderWidth: 0, borderRadius: 24, padding: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12 }}>
                                        <CardHeader style={{ padding: 16 }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <View style={{ flex: 1, paddingRight: 8 }}>
                                                    <CardTitle style={{ fontSize: 18, fontWeight: '700', color: '#F8FAFC' }}>Order #{shipment.orderId}</CardTitle>
                                                </View>
                                                <View style={{ alignItems: 'flex-end', gap: 8 }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245, 158, 11, 0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.2)', gap: 6 }}>
                                                        <Clock size={12} color="#f59e0b" />
                                                        <Text style={{ color: '#f59e0b', fontSize: 11, fontWeight: '700' }}>New Arrival</Text>
                                                    </View>
                                                </View>
                                            </View>
                                        </CardHeader>
                                        <CardContent style={{ padding: 16, paddingTop: 0 }}>
                                            {/* Reuse the same card content structure */}
                                            <View style={{ gap: 12, marginBottom: 16 }}>
                                                <View style={{ backgroundColor: '#0f172a', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#334155' }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                                        <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(124, 58, 237, 0.15)', justifyContent: 'center', alignItems: 'center' }}>
                                                            <MapPin size={16} color="#7C3AED" strokeWidth={2.5} />
                                                        </View>
                                                        <Text style={{ color: '#F8FAFC', fontWeight: '800', fontSize: 14 }}>Vendor Location</Text>
                                                    </View>
                                                    <View style={{ paddingLeft: 26 }}>
                                                        <Text style={{ color: '#F8FAFC', fontWeight: '600', fontSize: 13, marginBottom: 4 }}>{shipment.vendorName}</Text>
                                                        <Text style={{ color: '#E2E8F0', fontSize: 13, lineHeight: 18 }}>{shipment.vendorAddress}</Text>
                                                        {shipment.vendorFullAddress && <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 2, lineHeight: 16 }}>{shipment.vendorFullAddress}</Text>}
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start' }}>
                                                            <Phone size={13} color="#10B981" strokeWidth={2.5} />
                                                            <Text style={{ color: '#10B981', fontSize: 13, fontWeight: '700' }}>{shipment.vendorContact}</Text>
                                                        </View>
                                                    </View>
                                                </View>

                                                <View style={{ backgroundColor: '#0f172a', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#334155' }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                                        <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(16, 185, 129, 0.15)', justifyContent: 'center', alignItems: 'center' }}>
                                                            <User size={16} color="#10B981" strokeWidth={2.5} />
                                                        </View>
                                                        <Text style={{ color: '#F8FAFC', fontWeight: '800', fontSize: 14 }}>Customer Destination</Text>
                                                    </View>
                                                    <View style={{ paddingLeft: 26 }}>
                                                        <Text style={{ color: '#F8FAFC', fontWeight: '600', fontSize: 13, marginBottom: 4 }}>{shipment.customerName}</Text>
                                                        <Text style={{ color: '#E2E8F0', fontSize: 13, lineHeight: 18 }}>{shipment.customerAddress}</Text>
                                                    </View>
                                                </View>
                                            </View>

                                            <View style={{ marginBottom: 16 }}>
                                                <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Items Overview</Text>
                                                {shipment.items.map((item, idx) => (
                                                    <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, alignItems: 'flex-start', borderBottomWidth: idx === shipment.items.length - 1 ? 0 : 1, borderBottomColor: 'rgba(51, 65, 85, 0.5)', paddingBottom: idx === shipment.items.length - 1 ? 0 : 10 }}>
                                                        <View style={{ flex: 1, paddingRight: 12 }}>
                                                            <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '500', lineHeight: 20 }}>{item.name}</Text>
                                                        </View>
                                                        <View style={{ alignItems: 'flex-end', minWidth: 80 }}>
                                                            <Text style={{ color: '#94A3B8', fontSize: 13 }}>Qty: <Text style={{ color: '#F8FAFC', fontWeight: '700' }}>{(shipment.items.length === 1 && shipment.quantity) ? shipment.quantity : (item.qty || item.quantity)}</Text></Text>

                                                        </View>
                                                    </View>
                                                ))}
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#334155' }}>
                                                    <Text style={{ color: '#10B981', fontWeight: '600', fontSize: 14 }}>Total to Collect</Text>
                                                    <Text style={{ color: '#10B981', fontWeight: '800', fontSize: 18 }}>₹{shipment.totalAmount}</Text>
                                                </View>
                                            </View>

                                            {/* Actions Logic reused */}
                                            {selectedShipment === shipment.id ? (
                                                <View testID="no-print" style={{ marginTop: 16 }}>
                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                                        <Text style={{ color: '#94A3B8', fontSize: 14 }}>Payment Status:</Text>
                                                        <View style={{ backgroundColor: '#7C3AED', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 }}>
                                                            <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>{shipment.paymentStatus || 'Paid'}</Text>
                                                        </View>
                                                    </View>

                                                    <View style={{ marginBottom: 20 }}>
                                                        <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '700', marginBottom: 4 }}>
                                                            Upload Collection Photos <Text style={{ color: '#EF4444' }}>*</Text>
                                                        </Text>
                                                        <Text style={{ color: '#94A3B8', fontSize: 12, marginBottom: 12 }}>Take photos of items before collection</Text>

                                                        {uploadedPhotos.length > 0 && (
                                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                                                                {uploadedPhotos.map((photo, index) => (
                                                                    <View key={index} style={{ width: 80, height: 80, borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
                                                                        <Image source={{ uri: photo }} style={{ width: '100%', height: '100%' }} />
                                                                        <TouchableOpacity onPress={() => removePhoto(index)} style={{ position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(239, 68, 68, 0.9)', padding: 5, borderRadius: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 5 }}>
                                                                            <X size={14} color="#FFF" strokeWidth={3} />
                                                                        </TouchableOpacity>
                                                                    </View>
                                                                ))}
                                                            </View>
                                                        )}

                                                        <TouchableOpacity onPress={handleTakePhoto} style={{ backgroundColor: '#0f172a', padding: 16, borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, borderColor: '#334155', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
                                                            <Camera size={20} color="#F8FAFC" />
                                                            <Text style={{ color: '#F8FAFC', fontWeight: '600' }}>Add Photos</Text>
                                                        </TouchableOpacity>
                                                    </View>

                                                    <View style={{ marginBottom: 20 }}>
                                                        <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '700', marginBottom: 8 }}>Collection Notes <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '400' }}>(Optional)</Text></Text>
                                                        <Input
                                                            placeholder="Add any notes about the collection..."
                                                            value={collectionNotes}
                                                            onChangeText={handleNotesChange}
                                                            multiline
                                                            numberOfLines={3}
                                                            error={errors.notes}
                                                            inputStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 12, color: '#F8FAFC', height: 80, textAlignVertical: 'top' }}
                                                        />
                                                    </View>

                                                    <View style={{ flexDirection: 'row', gap: 12 }}>
                                                        <TouchableOpacity onPress={() => !isSubmitting && handleCollect(shipment.id)} style={{ flex: 1, opacity: isSubmitting ? 0.7 : 1 }} disabled={isSubmitting}>
                                                            <LinearGradient
                                                                colors={['#8B5CF6', '#EC4899']}
                                                                start={{ x: 0, y: 0 }}
                                                                end={{ x: 1, y: 0 }}
                                                                style={{ height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8 }}
                                                            >
                                                                <CheckCircle size={18} color="#FFF" />
                                                                <Text style={{ color: '#FFF', fontWeight: '700' }}>Confirm Collection</Text>
                                                            </LinearGradient>
                                                        </TouchableOpacity>

                                                        <TouchableOpacity onPress={() => setSelectedShipment(null)} style={{ paddingHorizontal: 24, height: 48, borderRadius: 12, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', justifyContent: 'center', alignItems: 'center' }}>
                                                            <Text style={{ color: '#F8FAFC', fontWeight: '600' }}>Cancel</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            ) : (
                                                <TouchableOpacity
                                                    testID="no-print"
                                                    onPress={() => setSelectedShipment(shipment.id)}
                                                    activeOpacity={0.8}
                                                >
                                                    <LinearGradient
                                                        colors={['#8B5CF6', '#EC4899']}
                                                        start={{ x: 0, y: 0 }}
                                                        end={{ x: 1, y: 0 }}
                                                        style={{ height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 10 }}
                                                    >
                                                        <Package size={20} color="#FFFFFF" />
                                                        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>Begin Collection</Text>
                                                    </LinearGradient>
                                                </TouchableOpacity>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </View>
                        );
                    })()}

                    {timeSlots.map((timeSlot) => {
                        const slotShipments = getShipmentsByTimeSlot(timeSlot.id);
                        if (slotShipments.length === 0) return null;

                        const freshOrders = getFreshOrders(timeSlot.id, slotShipments);
                        const hasFresh = freshOrders.length > 0;

                        return (
                            <View key={timeSlot.id} style={{ gap: 16 }}>
                                {/* Slot Header */}
                                <LinearGradient
                                    colors={['#8B5CF6', '#EC4899']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16, shadowColor: '#EC4899', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                        <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' }}>
                                            <Clock size={18} color="#FFFFFF" />
                                        </View>
                                        <View>
                                            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>{slotShipments.length} Pending Orders</Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => hasFresh && generatePDF(timeSlot, freshOrders)}
                                        disabled={!hasFresh}
                                        style={{ padding: 8, backgroundColor: !hasFresh ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255,255,255,0.15)', borderRadius: 10 }}>
                                        {!hasFresh ? <Check size={18} color="#22c55e" /> : <Download size={18} color="#FFFFFF" />}
                                    </TouchableOpacity>
                                </LinearGradient>

                                {slotShipments.map((shipment) => (
                                    <Card key={shipment.id} style={{ backgroundColor: '#1e293b', borderWidth: 0, borderRadius: 24, padding: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12 }}>
                                        <CardHeader style={{ padding: 16 }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <View style={{ flex: 1, paddingRight: 8 }}>
                                                    <CardTitle style={{ fontSize: 18, fontWeight: '700', color: '#F8FAFC' }}>Order #{shipment.orderId}</CardTitle>
                                                </View>
                                                <View style={{ alignItems: 'flex-end', gap: 8 }}>
                                                    {(downloadedSlots[timeSlot.id] || []).includes(shipment.id) && (
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(34, 197, 94, 0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(34, 197, 94, 0.2)', gap: 6 }}>
                                                            <Check size={12} color="#22c55e" />
                                                            <Text style={{ color: '#22c55e', fontSize: 11, fontWeight: '700' }}>Downloaded</Text>
                                                        </View>
                                                    )}
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(217, 119, 6, 0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(217, 119, 6, 0.2)', gap: 6 }}>
                                                        <Clock size={12} color="#D97706" />
                                                        <Text style={{ color: '#D97706', fontSize: 11, fontWeight: '700' }}>Awaiting Pickup</Text>
                                                    </View>
                                                </View>
                                            </View>
                                        </CardHeader>
                                        <CardContent style={{ padding: 16, paddingTop: 0 }}>
                                            <View style={{ gap: 12, marginBottom: 16 }}>
                                                {/* Vendor Location */}
                                                <View style={{ backgroundColor: '#0f172a', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#334155' }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                                        <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(124, 58, 237, 0.15)', justifyContent: 'center', alignItems: 'center' }}>
                                                            <MapPin size={16} color="#7C3AED" strokeWidth={2.5} />
                                                        </View>
                                                        <Text style={{ color: '#F8FAFC', fontWeight: '800', fontSize: 14 }}>Vendor Location</Text>
                                                    </View>
                                                    <View style={{ paddingLeft: 26 }}>
                                                        <Text style={{ color: '#F8FAFC', fontWeight: '600', fontSize: 13, marginBottom: 4 }}>{shipment.vendorName}</Text>
                                                        <Text style={{ color: '#E2E8F0', fontSize: 13, lineHeight: 18 }}>{shipment.vendorAddress}</Text>
                                                        {shipment.vendorFullAddress && <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 2, lineHeight: 16 }}>{shipment.vendorFullAddress}</Text>}
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start' }}>
                                                            <Phone size={13} color="#10B981" strokeWidth={2.5} />
                                                            <Text style={{ color: '#10B981', fontSize: 13, fontWeight: '700' }}>{shipment.vendorContact}</Text>
                                                        </View>
                                                    </View>
                                                </View>

                                                {/* Customer Details */}
                                                <View style={{ backgroundColor: '#0f172a', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#334155' }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                                        <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(16, 185, 129, 0.15)', justifyContent: 'center', alignItems: 'center' }}>
                                                            <User size={16} color="#10B981" strokeWidth={2.5} />
                                                        </View>
                                                        <Text style={{ color: '#F8FAFC', fontWeight: '800', fontSize: 14 }}>Customer Destination</Text>
                                                    </View>
                                                    <View style={{ paddingLeft: 26 }}>
                                                        <Text style={{ color: '#F8FAFC', fontWeight: '600', fontSize: 13, marginBottom: 4 }}>{shipment.customerName}</Text>
                                                        <Text style={{ color: '#E2E8F0', fontSize: 13, lineHeight: 18 }}>{shipment.customerAddress}</Text>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start' }}>
                                                            <Phone size={13} color="#10B981" strokeWidth={2.5} />
                                                            <Text style={{ color: '#10B981', fontSize: 13, fontWeight: '700' }}>{shipment.customerContact}</Text>
                                                        </View>
                                                    </View>
                                                </View>
                                            </View>

                                            <View style={{ marginBottom: 16 }}>
                                                <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Items Overview</Text>
                                                {shipment.items.map((item, idx) => (
                                                    <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, alignItems: 'flex-start', borderBottomWidth: idx === shipment.items.length - 1 ? 0 : 1, borderBottomColor: 'rgba(51, 65, 85, 0.5)', paddingBottom: idx === shipment.items.length - 1 ? 0 : 10 }}>
                                                        <View style={{ flex: 1, paddingRight: 12 }}>
                                                            <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '500', lineHeight: 20 }}>{item.name}</Text>
                                                        </View>
                                                        <View style={{ alignItems: 'flex-end', minWidth: 80 }}>
                                                            <Text style={{ color: '#94A3B8', fontSize: 13 }}>Qty: <Text style={{ color: '#F8FAFC', fontWeight: '700' }}>{(shipment.items.length === 1 && shipment.quantity) ? shipment.quantity : (item.qty || item.quantity)}</Text></Text>

                                                        </View>
                                                    </View>
                                                ))}
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#334155' }}>
                                                    <Text style={{ color: '#10B981', fontWeight: '600', fontSize: 14 }}>Total to Collect</Text>
                                                    <Text style={{ color: '#10B981', fontWeight: '800', fontSize: 18 }}>₹{shipment.totalAmount}</Text>
                                                </View>
                                            </View>

                                            {/* Image Verification Section */}


                                            {selectedShipment === shipment.id ? (
                                                <View testID="no-print" style={{ marginTop: 16 }}>
                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                                        <Text style={{ color: '#94A3B8', fontSize: 14 }}>Payment Status:</Text>
                                                        <View style={{ backgroundColor: '#7C3AED', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 }}>
                                                            <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>{shipment.paymentStatus || 'Paid'}</Text>
                                                        </View>
                                                    </View>

                                                    <View style={{ marginBottom: 20 }}>
                                                        <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '700', marginBottom: 4 }}>
                                                            Upload Collection Photos <Text style={{ color: '#EF4444' }}>*</Text>
                                                        </Text>
                                                        <Text style={{ color: '#94A3B8', fontSize: 12, marginBottom: 12 }}>Take photos of items before collection</Text>

                                                        {uploadedPhotos.length > 0 && (
                                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                                                                {uploadedPhotos.map((photo, index) => (
                                                                    <View key={index} style={{ width: 80, height: 80, borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
                                                                        <Image source={{ uri: photo }} style={{ width: '100%', height: '100%' }} />
                                                                        <TouchableOpacity onPress={() => removePhoto(index)} style={{ position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(239, 68, 68, 0.9)', padding: 5, borderRadius: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 5 }}>
                                                                            <X size={14} color="#FFF" strokeWidth={3} />
                                                                        </TouchableOpacity>
                                                                    </View>
                                                                ))}
                                                            </View>
                                                        )}

                                                        <TouchableOpacity onPress={handleTakePhoto} style={{ backgroundColor: '#0f172a', padding: 16, borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, borderColor: '#334155', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
                                                            <Camera size={20} color="#F8FAFC" />
                                                            <Text style={{ color: '#F8FAFC', fontWeight: '600' }}>Add Photos</Text>
                                                        </TouchableOpacity>
                                                    </View>

                                                    <View style={{ marginBottom: 20 }}>
                                                        <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '700', marginBottom: 8 }}>Collection Notes <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '400' }}>(Optional)</Text></Text>
                                                        <Input
                                                            placeholder="Add any notes about the collection..."
                                                            value={collectionNotes}
                                                            onChangeText={handleNotesChange}
                                                            multiline
                                                            numberOfLines={3}
                                                            error={errors.notes}
                                                            inputStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 12, color: '#F8FAFC', height: 80, textAlignVertical: 'top' }}
                                                        />
                                                    </View>

                                                    <View style={{ flexDirection: 'row', gap: 12 }}>
                                                        <TouchableOpacity onPress={() => !isSubmitting && handleCollect(shipment.id)} style={{ flex: 1, opacity: isSubmitting ? 0.7 : 1 }} disabled={isSubmitting}>
                                                            <LinearGradient
                                                                colors={['#8B5CF6', '#EC4899']}
                                                                start={{ x: 0, y: 0 }}
                                                                end={{ x: 1, y: 0 }}
                                                                style={{ height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8 }}
                                                            >
                                                                <CheckCircle size={18} color="#FFF" />
                                                                <Text style={{ color: '#FFF', fontWeight: '700' }}>{isSubmitting ? 'Processing...' : 'Confirm Collection'}</Text>
                                                            </LinearGradient>
                                                        </TouchableOpacity>

                                                        <TouchableOpacity onPress={() => setSelectedShipment(null)} style={{ paddingHorizontal: 24, height: 48, borderRadius: 12, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', justifyContent: 'center', alignItems: 'center' }}>
                                                            <Text style={{ color: '#F8FAFC', fontWeight: '600' }}>Cancel</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            ) : (
                                                <TouchableOpacity
                                                    testID="no-print"
                                                    onPress={() => setSelectedShipment(shipment.id)}
                                                    activeOpacity={0.8}
                                                >
                                                    <LinearGradient
                                                        colors={['#8B5CF6', '#EC4899']}
                                                        start={{ x: 0, y: 0 }}
                                                        end={{ x: 1, y: 0 }}
                                                        style={{ height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 10 }}
                                                    >
                                                        <Package size={20} color="#FFFFFF" />
                                                        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>Begin Collection</Text>
                                                    </LinearGradient>
                                                </TouchableOpacity>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </View>
                        );
                    })}
                </View>
            )}
        </ScrollView>
    );
}
