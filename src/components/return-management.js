import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Modal, Platform, Image } from 'react-native';
import { Card, CardContent } from './ui/card';
import { Package, AlertCircle, RotateCcw, Truck, ArrowRight, CornerUpLeft, Clock, Box, CheckCircle, ShoppingBag, MapPin, Phone, Mail, ChevronRight, X, User, ChevronDown, Navigation, Download, FileText, Image as ImageIcon, Printer, IndianRupee } from 'lucide-react-native';

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';

export function ReturnManagement({ shipments = [], deliveryBoys = [], distributors = [], onSchedulePickup, onConfirmHubDelivery, onConfirmHubExchange, onDownloadReport, onDownloadCompletedReport }) {
    const [activeFilter, setActiveFilter] = useState('requested');
    const [schedulingModalVisible, setSchedulingModalVisible] = useState(false);
    const [selectedShipmentForModal, setSelectedShipmentForModal] = useState(null);
    const [selectedBoy, setSelectedBoy] = useState(null);
    const [showBoyDropdown, setShowBoyDropdown] = useState(false);
    const [assignmentMode, setAssignmentMode] = useState('driver'); // 'driver' or 'distributor'
    const [activeSubFilter, setActiveSubFilter] = useState('Return');
    const [selectedFullImage, setSelectedFullImage] = useState(null);
    const [toast, setToast] = useState(null); // { message, type }

    const showToast = (message, type = 'warning') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    };

    const shipmentsWithReturns = shipments.filter(s => s.returnInfo);

    const counts = {
        requested: shipmentsWithReturns.filter(s => s.returnInfo.status === 'requested' || s.returnInfo.status === 'confirmed-requested').length,
        inTransit: shipmentsWithReturns.filter(s => {
            const status = s.returnInfo.status;
            const requestType = s.returnInfo.requestType;
            const isHubConfirmed = s.returnInfo.isHubConfirmed;
            const inTransitStatuses = ['in-transit', 'assigned', 'pickedup', 'failed'];
            if (requestType === 'Exchange') {
                return inTransitStatuses.includes(status);
            } else {
                return inTransitStatuses.includes(status) && !isHubConfirmed;
            }
        }).length,
        completed: shipmentsWithReturns.filter(s => {
            const status = s.returnInfo.status;
            const requestType = s.returnInfo.requestType;
            const isHubConfirmed = s.returnInfo.isHubConfirmed;
            const completedStatuses = ['received', 'approved', 'pickedupanddelivered'];
            if (requestType === 'Exchange') {
                return completedStatuses.includes(status);
            } else {
                return completedStatuses.includes(status) || isHubConfirmed;
            }
        }).length,
        pendingReport: shipmentsWithReturns.filter(s => (s.returnInfo.status === 'requested' || s.returnInfo.status === 'confirmed-requested') && !s.returnInfo.isDownloaded).length
    };

    const pendingReturnsReportCount = shipmentsWithReturns.filter(s =>
        (s.returnInfo.status === 'requested' || s.returnInfo.status === 'confirmed-requested') &&
        !s.returnInfo.isDownloaded &&
        (s.returnInfo.requestType === 'Return' || !s.returnInfo.requestType)
    ).length;

    const statusFilteredShipments = shipmentsWithReturns.filter(s => {
        if (activeFilter === 'requested') {
            return s.returnInfo.status === 'requested' || s.returnInfo.status === 'confirmed-requested';
        }
        if (activeFilter === 'in-transit') {
            const status = s.returnInfo.status;
            const requestType = s.returnInfo.requestType;
            const isHubConfirmed = s.returnInfo.isHubConfirmed;
            // 'failed' stays in In Transit tab (visible but marked failed)
            const inTransitStatuses = ['in-transit', 'assigned', 'pickedup', 'failed'];
            if (requestType === 'Exchange') {
                return inTransitStatuses.includes(status);
            } else {
                return inTransitStatuses.includes(status) && !isHubConfirmed;
            }
        }
        // completed tab
        const status = s.returnInfo.status;
        const requestType = s.returnInfo.requestType;
        const isHubConfirmed = s.returnInfo.isHubConfirmed;
        const completedStatuses = ['received', 'approved', 'pickedupanddelivered'];
        if (requestType === 'Exchange') {
            return completedStatuses.includes(status);
        } else {
            return completedStatuses.includes(status) || isHubConfirmed;
        }
    });

    const filteredShipments = statusFilteredShipments.filter(s => {
        if (activeFilter === 'requested' || activeFilter === 'received') {
            return activeSubFilter === 'Return'
                ? (s.returnInfo.requestType === 'Return' || !s.returnInfo.requestType)
                : (s.returnInfo.requestType === 'Exchange');
        }
        return true;
    });


    const pendingShipments = filteredShipments.filter(s => !s.returnInfo.isDownloaded);

    const getGroupedShipments = () => {
        // Dynamic date calculation
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        // Helper to format as DD/MM/YYYY to match App.js format
        const formatDate = (date) => {
            const d = date.getDate().toString().padStart(2, '0');
            const m = (date.getMonth() + 1).toString().padStart(2, '0');
            const y = date.getFullYear();
            return `${d}/${m}/${y}`;
        };

        const todayStr = formatDate(today);
        const yesterdayStr = formatDate(yesterday);

        return {
            "Today": filteredShipments.filter(s => s.returnInfo.requestDate === todayStr),
            "Yesterday": filteredShipments.filter(s => s.returnInfo.requestDate === yesterdayStr),
            "Earlier": filteredShipments.filter(s => s.returnInfo.requestDate !== todayStr && s.returnInfo.requestDate !== yesterdayStr)
        };
    };

    const handleDownloadReport = async (itemsToDownload, typeLabel, isCompleted = false) => {
        if (itemsToDownload.length === 0) {
            Alert.alert("All Clear", `No new confirmed ${typeLabel.toLowerCase()} orders to download.`);
            return;
        }

        const vendorGroups = itemsToDownload.reduce((acc, s) => {
            const key = s.vendorName || 'Unknown Vendor';
            if (!acc[key]) {
                acc[key] = {
                    details: {
                        name: key,
                        address: s.vendorAddress || 'N/A',
                        phone: s.vendorContact || 'N/A'
                    },
                    items: []
                };
            }
            acc[key].items.push(s);
            return acc;
        }, {});

        const html = `
            <html>
                <head>
                    <style>
                        body { font-family: sans-serif; padding: 20px; color: #1e293b; }
                        .header { border-bottom: 2px solid #7C3AED; margin-bottom: 20px; padding-bottom: 10px; }
                        .title { color: #7C3AED; font-size: 20px; font-weight: bold; }
                        .vendor-block { margin-top: 30px; page-break-inside: avoid; }
                        .vendor-info { background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #7C3AED; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                        th { text-align: left; background: #f1f5f9; padding: 12px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e2e8f0; }
                        td { padding: 12px 10px; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
                        .order-id { font-weight: 800; color: #0f172a; }
                        .return-id { color: #EAB308; font-weight: 700; font-size: 10px; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="title">${typeLabel.toUpperCase()} ORDERS SUMMARY</div>
                        <div style="font-size: 12px; color: #64748B; margin-top: 5px;">Generated on ${new Date().toLocaleString('en-GB')}</div>
                    </div>
                    ${Object.values(vendorGroups).map(group => `
                        <div class="vendor-block">
                            <div class="vendor-info">
                                <div style="font-size: 14px; font-weight: 800; color: #7C3AED;">VENDOR: ${group.details.name}</div>
                                <div style="font-size: 11px; margin-top: 4px;">ADDR: ${group.details.address}</div>
                                <div style="font-size: 11px;">CONTACT: ${group.details.phone}</div>
                            </div>
                            <table>
                                <thead>
                                    <tr>
                                        <th style="width: 25%">Order / Return</th>
                                        <th style="width: 55%">Item Details</th>
                                        <th style="width: 20%; text-align: center;">Qty</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${group.items.map(s => `
                                        <tr>
                                            <td>
                                                <div class="order-id">#${s.orderId}</div>
                                                <div class="return-id">RET: #${s.returnId || 'N/A'}</div>
                                            </td>
                                            <td>
                                                <div style="font-weight: 600;">${s.returnInfo.productName || 'N/A'}</div>
                                                <div style="color: #64748B; font-size: 10px;">Reason: ${s.returnInfo.reason}</div>
                                                <div style="color: #64748B; font-size: 10px;">Status: ${s.returnInfo.status}</div>
                                            </td>
                                            <td style="text-align: center; font-weight: bold;">
                                                <div style="font-size: 10px; color: #7C3AED;">ORD: ${s.returnInfo.orderedQuantity || '-'}</div>
                                                <div style="font-size: 12px; color: ${s.returnInfo.requestType === 'Exchange' ? '#3B82F6' : '#EF4444'};">
                                                    ${s.returnInfo.requestType === 'Exchange' ? 'EXC' : 'RET'}: ${s.returnInfo.returnExchangeQuantity || s.returnInfo.returnQuantity || 1}
                                                </div>
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
                const win = window.open('', '', 'height=600,width=800');
                if (win) {
                    win.document.write(html);
                    win.document.close();
                    win.focus();
                    setTimeout(() => {
                        win.print();
                        if (isCompleted && onDownloadCompletedReport) {
                            onDownloadCompletedReport(itemsToDownload.map(s => s.id));
                        } else if (onDownloadReport) {
                            onDownloadReport(itemsToDownload.map(s => s.id));
                        }
                    }, 500);
                } else {
                    Alert.alert("Popup Blocked", "Please allow popups to download the PDF.");
                }
            } else {
                const { uri } = await Print.printToFileAsync({ html });
                await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
                if (isCompleted && onDownloadCompletedReport) {
                    onDownloadCompletedReport(itemsToDownload.map(s => s.id));
                } else if (onDownloadReport) {
                    onDownloadReport(itemsToDownload.map(s => s.id));
                }
            }
        } catch (err) {
            console.error(err);
            Alert.alert("Error", "Failed to process PDF download");
        }
    };

    const handleOpenSchedule = (shipment) => {
        setSelectedShipmentForModal(shipment);
        setSchedulingModalVisible(true);
    };

    const handleAssign = (boy) => {
        const title = "Confirm Assignment";
        const message = `Are you sure you want to assign ${boy.name} for this return pickup?`;

        const proceed = () => {
            setSelectedBoy(boy);
            setShowBoyDropdown(false);
            onSchedulePickup(selectedShipmentForModal.id, boy, assignmentMode);
            setSchedulingModalVisible(false);
            setSelectedShipmentForModal(null);
            setSelectedBoy(null);
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`${title}\n\n${message}`)) {
                proceed();
            }
        } else {
            Alert.alert(
                title,
                message,
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Assign", style: "default", onPress: proceed }
                ]
            );
        }
    };

    const SummaryCard = ({ title, count, subtitle, icon: Icon, id }) => (
        <TouchableOpacity
            onPress={() => setActiveFilter(id)}
            style={{
                flex: 1,
                backgroundColor: '#1e293b',
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: activeFilter === id ? '#EAB308' : '#334155',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 10,
                elevation: 4
            }}
        >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ color: '#F8FAFC', fontWeight: '800', fontSize: 13 }}>{title}</Text>
                <Icon size={18} color={activeFilter === id ? '#EAB308' : '#64748B'} />
            </View>
            <Text style={{ color: '#F8FAFC', fontSize: 24, fontWeight: '900', marginBottom: 4 }}>{count}</Text>
            <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '600' }}>{subtitle}</Text>
        </TouchableOpacity>
    );

    const getStatusStyles = (status) => {
        const s = status?.toLowerCase();
        switch (s) {
            case 'pending':
            case 'requested':
                return { bg: 'rgba(234, 179, 8, 0.1)', text: '#EAB308', label: 'PENDING' };
            case 'confirmed-requested':
                return { bg: 'rgba(16, 185, 129, 0.1)', text: '#10B981', label: 'CONFIRMED' };
            case 'assigned':
                return { bg: 'rgba(56, 189, 248, 0.1)', text: '#38BDF8', label: 'ASSIGNED' };
            case 'pickedup':
                return { bg: 'rgba(16, 185, 129, 0.1)', text: '#10B981', label: 'PICKED UP' };
            case 'in-transit':
                return { bg: 'rgba(56, 189, 248, 0.1)', text: '#38BDF8', label: 'IN TRANSIT' };

            case 'received':
            case 'approved':
            case 'pickedupanddelivered':
                return { bg: 'rgba(124, 58, 237, 0.1)', text: '#7C3AED', label: 'COMPLETED' };
            case 'failed':
                return { bg: 'rgba(239, 68, 68, 0.12)', text: '#EF4444', label: 'FAILED' };
            default:
                return { bg: '#1e293b', text: '#94A3B8', label: status?.toUpperCase() || 'UNKNOWN' };
        }
    };

    const [imageErrors, setImageErrors] = useState({});
    const [isSubmittingHub, setIsSubmittingHub] = useState({});
    const [pickedExchangeImages, setPickedExchangeImages] = useState({});

    const pickExchangeImage = async (id) => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.7,
            base64: true
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
            setPickedExchangeImages(prev => ({ ...prev, [id]: base64 }));
        }
    };

    const handleImageError = (id) => {
        setImageErrors(prev => ({ ...prev, [id]: true }));
    };

    const renderShipmentCard = (shipment) => (
        <Card key={shipment.id} style={{ backgroundColor: '#141e33', borderWidth: 1, borderColor: '#1e293b', borderRadius: 24, overflow: 'hidden', marginBottom: 20 }}>
            <CardContent style={{ padding: 20 }}>
                {/* ... existing header ... */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: '#F8FAFC' }}>Order #{shipment.orderId}</Text>
                        {shipment.returnId && (
                            <Text style={{ fontSize: 12, color: '#EAB308', fontWeight: '700', marginTop: 2 }}>Return #{shipment.returnId}</Text>
                        )}
                        <Text style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>{shipment.vendorName}</Text>
                    </View>

                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                        <View style={{
                            backgroundColor: getStatusStyles(shipment.returnInfo.status).bg,
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: getStatusStyles(shipment.returnInfo.status).text + '33'
                        }}>
                            <Text style={{
                                color: getStatusStyles(shipment.returnInfo.status).text,
                                fontSize: 10,
                                fontWeight: '900',
                                letterSpacing: 1
                            }}>
                                {getStatusStyles(shipment.returnInfo.status).label}
                            </Text>
                        </View>
                        {activeFilter === 'requested' && shipment.returnInfo.isDownloaded && (
                            <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.2)' }}>
                                <CheckCircle size={10} color="#10B981" />
                                <Text style={{ color: '#10B981', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 }}>DOWNLOADED</Text>
                            </View>
                        )}

                        {shipment.returnInfo.isRefund === 'Refunded' && (
                            <View style={{
                                backgroundColor: '#EF4444',
                                paddingHorizontal: 12,
                                paddingVertical: 4,
                                borderRadius: 8,
                                marginTop: 4
                            }}>
                                <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '900', textAlign: 'center' }}>REFUNDED</Text>
                            </View>
                        )}

                        {((shipment.returnInfo.status === 'requested' || shipment.returnInfo.status === 'confirmed-requested') && shipment.returnInfo.isDownloaded && (shipment.returnInfo.requestType !== 'Exchange' || shipment.returnInfo.isHubConfirmed)) && (
                            <TouchableOpacity
                                onPress={() => handleOpenSchedule(shipment)}
                                style={{ backgroundColor: '#7C3AED', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, marginTop: 4 }}>
                                <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 13 }}>Schedule Pickup</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>



                {/* Product Info Section */}
                <View style={{ backgroundColor: '#0f172a', borderRadius: 16, padding: 16, marginBottom: 20 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', gap: 12, flex: 1 }}>
                            <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                                {(shipment.returnInfo.productImageUrl && !imageErrors[shipment.id]) ? (
                                    <Image
                                        source={{ uri: shipment.returnInfo.productImageUrl }}
                                        style={{ width: '100%', height: '100%' }}
                                        resizeMode="cover"
                                        onError={() => handleImageError(shipment.id)}
                                    />
                                ) : (
                                    <Box size={24} color="#7C3AED" />
                                )}
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '800' }}>{shipment.returnInfo.productName || 'Unknown Product'}</Text>
                                <Text style={{ color: '#64748B', fontSize: 11 }}>Price: ₹{shipment.returnInfo.productPrice || 0} • Qty: {shipment.returnInfo.returnExchangeQuantity || shipment.returnInfo.returnQuantity || 1} / {shipment.returnInfo.orderedQuantity || '-'}</Text>
                            </View>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <View style={{ backgroundColor: shipment.returnInfo.requestType === 'Exchange' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: shipment.returnInfo.requestType === 'Exchange' ? '#3B82F633' : '#EF444433' }}>
                                <Text style={{ color: shipment.returnInfo.requestType === 'Exchange' ? '#3B82F6' : '#EF4444', fontSize: 10, fontWeight: '900' }}>{shipment.returnInfo.requestType || 'Return'}</Text>
                            </View>
                        </View>
                    </View>

                    {shipment.returnInfo.refundAmount > 0 && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(16, 185, 129, 0.05)', padding: 8, borderRadius: 8, marginBottom: 8 }}>
                            <IndianRupee size={12} color="#10B981" />
                            <Text style={{ color: '#10B981', fontSize: 11, fontWeight: '800' }}>
                                Refund Amount: ₹{shipment.returnInfo.refundAmount.toLocaleString()}
                            </Text>
                            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: shipment.returnInfo.isRefund === 'Refunded' ? '#EF4444' : '#64748B', marginLeft: 'auto' }} />
                            <Text style={{ color: shipment.returnInfo.isRefund === 'Refunded' ? '#EF4444' : '#94A3B8', fontSize: 9, fontWeight: '900', textTransform: 'uppercase' }}>{shipment.returnInfo.isRefund}</Text>
                        </View>
                    )}

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#1e293b', paddingTop: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <User size={12} color="#64748B" />
                            <Text style={{ color: '#F8FAFC', fontSize: 11, fontWeight: '700' }}>{shipment.returnInfo.driverName || shipment.returnInfo.distributorName || 'Unassigned'}</Text>
                        </View>
                        <Text style={{ color: '#64748B', fontSize: 10, fontWeight: '700' }}>DELIVERED BY</Text>
                    </View>
                </View>

                {/* Return Reason Box */}
                <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)', borderRadius: 12, padding: 14, marginBottom: 20, flexDirection: 'row', gap: 12 }}>
                    <AlertCircle size={18} color="#EF4444" />
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: '#EF4444', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginBottom: 4 }}>Return Reason</Text>
                        <Text style={{ color: '#F87171', fontSize: 13, fontWeight: '700' }}>{shipment.returnInfo.reason}</Text>
                    </View>
                </View>

                {/* Proof Images Gallery */}
                {shipment.returnInfo.images && shipment.returnInfo.images.length > 0 && (
                    <View style={{ marginBottom: 20 }}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                            {shipment.returnInfo.images.map((img, idx) => (
                                <TouchableOpacity key={idx} activeOpacity={0.9} onPress={() => setSelectedFullImage(img)}>
                                    <Image
                                        source={{ uri: img }}
                                        style={{ width: 100, height: 100, borderRadius: 16, backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#1e293b' }}
                                    />
                                    <View style={{ position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 6, paddingHorizontal: 4, paddingVertical: 2 }}>
                                        <Text style={{ color: '#FFF', fontSize: 8, fontWeight: '900' }}>{idx + 1}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}


                {/* Failed Pickup Alert Banner */}
                {shipment.returnInfo.status === 'failed' && (
                    <View style={{ backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: 14, padding: 16, marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <AlertCircle size={22} color="#EF4444" />
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '900', textTransform: 'uppercase', marginBottom: 2 }}>Pickup Failed</Text>
                            <Text style={{ color: '#F87171', fontSize: 12, fontWeight: '600' }}>{shipment.returnInfo.reason || 'The driver was unable to complete this pickup.'}</Text>
                        </View>
                    </View>
                )}

                {/* Completed Pickup Banner for pickedupanddelivered */}
                {shipment.returnInfo.status === 'pickedupanddelivered' && (
                    <View style={{ backgroundColor: 'rgba(124,58,237,0.1)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', borderRadius: 14, padding: 16, marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <CheckCircle size={22} color="#7C3AED" />
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: '#7C3AED', fontSize: 13, fontWeight: '900', textTransform: 'uppercase', marginBottom: 2 }}>Exchange Completed</Text>
                            <Text style={{ color: '#A78BFA', fontSize: 12, fontWeight: '600' }}>The exchange item has been picked up and delivered successfully.</Text>
                        </View>
                    </View>
                )}

                {/* Return Progress Visual if In Transit */}
                {(shipment.returnInfo.status === 'in-transit' || shipment.returnInfo.status === 'assigned' || shipment.returnInfo.status === 'pickedup') && (
                    <View style={{ backgroundColor: '#0f172a', borderRadius: 16, padding: 16, marginBottom: 20 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Navigation size={14} color="#38BDF8" />
                                <Text style={{ color: '#F8FAFC', fontSize: 12, fontWeight: '800', textTransform: 'uppercase' }}>
                                    {shipment.returnInfo.status === 'pickedup'
                                        ? 'ORDER PICKED UP - RETURN TO HUB'
                                        : (shipment.returnInfo.status === 'assigned'
                                            ? `ASSIGNED: ${shipment.returnInfo.driverName || 'NOT ASSIGNED'}`
                                            : 'Return in progress')}
                                </Text>
                            </View>
                            {shipment.returnInfo.status === 'pickedup' && (
                                !shipment.returnInfo.isHubConfirmed ? (
                                    <TouchableOpacity
                                        onPress={async () => {
                                            if (isSubmittingHub[shipment.id]) return;
                                            setIsSubmittingHub(prev => ({ ...prev, [shipment.id]: true }));
                                            try {
                                                await onConfirmHubDelivery(shipment.id);
                                            } finally {
                                                setIsSubmittingHub(prev => ({ ...prev, [shipment.id]: false }));
                                            }
                                        }}
                                        disabled={isSubmittingHub[shipment.id]}
                                        style={{
                                            backgroundColor: isSubmittingHub[shipment.id] ? '#1e293b' : '#10B981',
                                            paddingHorizontal: 12,
                                            paddingVertical: 6,
                                            borderRadius: 8,
                                            opacity: isSubmittingHub[shipment.id] ? 0.7 : 1
                                        }}>
                                        <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '900' }}>
                                            {isSubmittingHub[shipment.id] ? 'Processing...' : 'Confirm Hub'}
                                        </Text>
                                    </TouchableOpacity>
                                ) : (
                                    <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#10B981' }}>
                                        <Text style={{ color: '#10B981', fontSize: 10, fontWeight: '900' }}>HUB ARRIVED</Text>
                                    </View>
                                )
                            )}
                        </View>
                    </View>
                )}

                {/* Address Section */}
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                    <View style={{ flex: 1, backgroundColor: '#0f172a', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#1e293b' }}>
                        <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '800', marginBottom: 4 }}>{shipment.customerName}</Text>
                        <Text style={{ color: '#94A3B8', fontSize: 12, lineHeight: 18, marginBottom: 12 }} numberOfLines={2}>{shipment.customerAddress}</Text>
                        {shipment.customerContact && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Phone size={12} color="#7C3AED" />
                                <Text style={{ color: '#F8FAFC', fontSize: 12, fontWeight: '700' }}>{shipment.customerContact}</Text>
                            </View>
                        )}
                    </View>
                    <View style={{ flex: 1, backgroundColor: '#0f172a', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#1e293b' }}>
                        <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '800', marginBottom: 4 }}>{shipment.vendorName}</Text>
                        <Text style={{ color: '#94A3B8', fontSize: 12, lineHeight: 18, marginBottom: 12 }} numberOfLines={1}>{shipment.vendorAddress}</Text>
                        {shipment.vendorContact && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Phone size={12} color="#7C3AED" />
                                <Text style={{ color: '#F8FAFC', fontSize: 12, fontWeight: '700' }}>{shipment.vendorContact}</Text>
                            </View>
                        )}
                    </View>
                </View>


                {/* Footer Info */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Clock size={12} color="#64748B" />
                        <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '700' }}>{shipment.returnInfo.requestDate}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        {shipment.returnInfo.requestType === 'Return' && (
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={{ color: '#64748B', fontSize: 9, fontWeight: '700', textAlign: 'right' }}>REFUND AMOUNT</Text>
                                <Text style={{ color: '#10B981', fontSize: 16, fontWeight: '900' }}>₹{shipment.totalAmount}</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Exchange Specific Hub Confirmation (Moved to end) */}
                {shipment.returnInfo.requestType === 'Exchange' && (shipment.returnInfo.status === 'requested' || shipment.returnInfo.status === 'confirmed-requested') && !shipment.returnInfo.isHubConfirmed && shipment.returnInfo.isDownloaded && (
                    <View style={{ backgroundColor: '#0f172a', padding: 16, borderRadius: 16, marginTop: 20, borderWidth: 1, borderColor: '#334155' }}>
                        <Text style={{ color: '#7C3AED', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginBottom: 12 }}>Exchange Hub Arrival Confirmation</Text>

                        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                            <TouchableOpacity
                                onPress={() => pickExchangeImage(shipment.id)}
                                style={{ width: 80, height: 80, borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, borderColor: '#7C3AED', justifyContent: 'center', alignItems: 'center', backgroundColor: '#1e293b' }}>
                                {pickedExchangeImages[shipment.id] ? (
                                    <Image source={{ uri: pickedExchangeImages[shipment.id] }} style={{ width: '100%', height: '100%', borderRadius: 12 }} />
                                ) : (
                                    <ImageIcon size={24} color="#7C3AED" />
                                )}
                            </TouchableOpacity>

                            <View style={{ flex: 1 }}>
                                <Text style={{ color: '#F8FAFC', fontSize: 13, fontWeight: '700', marginBottom: 4 }}>Add Receipt Photo</Text>
                                <Text style={{ color: '#64748B', fontSize: 11, marginBottom: 12 }}>Upload a photo through gallery to confirm hub arrival</Text>

                                <TouchableOpacity
                                    disabled={!pickedExchangeImages[shipment.id] || isSubmittingHub[shipment.id]}
                                    onPress={async () => {
                                        setIsSubmittingHub(prev => ({ ...prev, [shipment.id]: true }));
                                        try {
                                            await onConfirmHubExchange(shipment.id, pickedExchangeImages[shipment.id]);
                                        } finally {
                                            setIsSubmittingHub(prev => ({ ...prev, [shipment.id]: false }));
                                        }
                                    }}
                                    style={{
                                        backgroundColor: !pickedExchangeImages[shipment.id] ? '#1e293b' : '#10B981',
                                        paddingVertical: 10,
                                        borderRadius: 10,
                                        alignItems: 'center',
                                        opacity: !pickedExchangeImages[shipment.id] ? 0.5 : 1
                                    }}>
                                    <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 12 }}>{isSubmittingHub[shipment.id] ? 'Confirming...' : 'Confirm Hub Arrival'}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )}

                {/* Exchange Confirmation Image Display (Moved to end) */}
                {shipment.returnInfo.requestType === 'Exchange' && shipment.returnInfo.exchangeImage && (
                    <View style={{ marginTop: 20 }}>
                        <Text style={{ color: '#10B981', fontSize: 9, fontWeight: '900', textTransform: 'uppercase', marginBottom: 8 }}>Hub Arrival Proof</Text>
                        <TouchableOpacity activeOpacity={0.9} onPress={() => setSelectedFullImage(shipment.returnInfo.exchangeImage)}>
                            <Image
                                source={{ uri: shipment.returnInfo.exchangeImage }}
                                style={{ width: 120, height: 120, borderRadius: 12, backgroundColor: '#1e293b' }}
                            />
                        </TouchableOpacity>
                    </View>
                )}
            </CardContent>
        </Card>
    );

    return (
        <View style={{ flex: 1, backgroundColor: '#0f172a', padding: 16 }}>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                {/* Summary Cards Row */}
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
                    <SummaryCard id="requested" title="Requested" count={counts.requested} subtitle="Awaiting pickup" icon={Clock} />
                    <SummaryCard id="in-transit" title="In Transit" count={counts.inTransit} subtitle="Being returned" icon={Box} />
                    <SummaryCard id="received" title="Completed" count={counts.completed} subtitle="Returns processed" icon={CheckCircle} />
                </View>

                {/* Toast Notification */}
                {toast && (
                    <View style={{
                        backgroundColor: toast.type === 'warning' ? 'rgba(234,179,8,0.15)' : 'rgba(16,185,129,0.15)',
                        borderWidth: 1,
                        borderColor: toast.type === 'warning' ? '#EAB308' : '#10B981',
                        borderRadius: 14,
                        padding: 14,
                        marginBottom: 16,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10
                    }}>
                        <AlertCircle size={16} color={toast.type === 'warning' ? '#EAB308' : '#10B981'} />
                        <Text style={{ color: toast.type === 'warning' ? '#EAB308' : '#10B981', fontSize: 13, fontWeight: '700', flex: 1 }}>{toast.message}</Text>
                    </View>
                )}

                {/* SUB-FILTER BUTTONS (Shared for Requested and Completed) */}
                {(activeFilter === 'requested' || activeFilter === 'received') && (
                    <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                        {[
                            { id: 'Return', label: 'RETURNS', color: '#EF4444' },
                            { id: 'Exchange', label: 'EXCHANGES', color: '#3B82F6' }
                        ].map(sub => {
                            const isActive = activeSubFilter === sub.id;
                            const count = statusFilteredShipments.filter(s =>
                                sub.id === 'Return' ? (s.returnInfo.requestType === 'Return' || !s.returnInfo.requestType) : (s.returnInfo.requestType === 'Exchange')
                            ).length;

                            return (
                                <TouchableOpacity
                                    key={sub.id}
                                    onPress={() => setActiveSubFilter(sub.id)}
                                    style={{
                                        flex: 1,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 10,
                                        paddingVertical: 14,
                                        borderRadius: 16,
                                        backgroundColor: isActive ? sub.color : '#1e293b',
                                        borderWidth: 1,
                                        borderColor: isActive ? sub.color : '#334155',
                                        shadowColor: isActive ? sub.color : '#000',
                                        shadowOpacity: isActive ? 0.3 : 0,
                                        shadowRadius: 10,
                                        elevation: isActive ? 4 : 0
                                    }}>
                                    <Text style={{ color: isActive ? '#FFF' : '#94A3B8', fontSize: 13, fontWeight: '900', letterSpacing: 0.5 }}>{sub.label}</Text>
                                    <View style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : '#0f172a', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                                        <Text style={{ color: isActive ? '#FFF' : '#64748B', fontSize: 11, fontWeight: '800' }}>{count}</Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                {filteredShipments.length === 0 ? (
                    <Card style={{ backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', borderRadius: 24, padding: 40, alignItems: 'center' }}>
                        <RotateCcw size={40} color="#7C3AED" style={{ marginBottom: 16 }} />
                        <Text style={{ color: '#F8FAFC', fontSize: 18, fontWeight: '600' }}>Queue is Empty</Text>
                        <Text style={{ color: '#64748B', fontSize: 14, textAlign: 'center', marginTop: 8 }}>No shipments found in this category.</Text>
                    </Card>
                ) : (
                    activeFilter === 'received' ? (
                        <View>
                             {/* DOWNLOAD COMPLETED REPORT BUTTON */}
                             {(() => {
                                 const hasNewCompleted = filteredShipments.some(s => !s.returnInfo.isCompletedDownloaded);
                                 return (
                                     <TouchableOpacity
                                         activeOpacity={hasNewCompleted ? 0.7 : 1}
                                         disabled={!hasNewCompleted}
                                         onPress={() => {
                                             const itemsToDownload = filteredShipments.filter(s => !s.returnInfo.isCompletedDownloaded);
                                             handleDownloadReport(itemsToDownload, activeSubFilter === 'Return' ? 'Completed Returns' : 'Completed Exchanges', true);
                                         }}
                                         style={{
                                             flexDirection: 'row',
                                             alignItems: 'center',
                                             justifyContent: 'center',
                                             gap: 10,
                                             backgroundColor: hasNewCompleted ? '#10B981' : '#1e293b',
                                             padding: 18,
                                             borderRadius: 16,
                                             marginBottom: 24,
                                             borderWidth: hasNewCompleted ? 0 : 1,
                                             borderColor: '#334155',
                                             opacity: hasNewCompleted ? 1 : 0.5,
                                             shadowColor: '#10B981',
                                             shadowOpacity: hasNewCompleted ? 0.3 : 0,
                                             shadowRadius: 10,
                                             elevation: hasNewCompleted ? 5 : 0
                                         }}
                                     >
                                         <FileText size={20} color={hasNewCompleted ? '#FFF' : '#64748B'} />
                                         <Text style={{ color: hasNewCompleted ? '#FFF' : '#64748B', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 }}>
                                             {activeSubFilter === 'Return' ? 'DOWNLOAD NEW COMPLETED RETURNS' : 'DOWNLOAD NEW COMPLETED EXCHANGES'}
                                         </Text>
                                         <Download size={20} color={hasNewCompleted ? '#FFF' : '#64748B'} />
                                     </TouchableOpacity>
                                 );
                             })()}

                            {Object.entries(getGroupedShipments()).map(([day, list]) => list.length > 0 && (
                                <View key={day} style={{ marginBottom: 24 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                                        <View style={{ height: 1, flex: 1, backgroundColor: '#334155' }} />
                                        <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 }}>{day}</Text>
                                        <View style={{ height: 1, flex: 1, backgroundColor: '#334155' }} />
                                    </View>
                                    {list.map(s => renderShipmentCard(s))}
                                </View>
                            ))}
                        </View>
                    ) : (
                        activeFilter === 'requested' ? (
                            <View>
                                {/* DOWNLOAD PENDING RETURNS BUTTON */}
                                {(() => {
                                    const hasNewPending = filteredShipments.some(s => !s.returnInfo.isDownloaded);
                                    return (
                                        <TouchableOpacity
                                            activeOpacity={hasNewPending ? 0.7 : 1}
                                            disabled={!hasNewPending}
                                            onPress={() => {
                                                const itemsToDownload = filteredShipments.filter(s => !s.returnInfo.isDownloaded);
                                                handleDownloadReport(itemsToDownload, activeSubFilter === 'Return' ? 'Pending Returns' : 'Pending Exchanges', false);
                                            }}
                                            style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 10,
                                                backgroundColor: hasNewPending ? '#7C3AED' : '#1e293b',
                                                padding: 18,
                                                borderRadius: 16,
                                                marginBottom: 24,
                                                borderWidth: hasNewPending ? 0 : 1,
                                                borderColor: '#334155',
                                                opacity: hasNewPending ? 1 : 0.5,
                                                shadowColor: '#7C3AED',
                                                shadowOpacity: hasNewPending ? 0.3 : 0,
                                                shadowRadius: 10,
                                                elevation: hasNewPending ? 5 : 0
                                            }}
                                        >
                                            <FileText size={20} color={hasNewPending ? '#FFF' : '#64748B'} />
                                            <Text style={{ color: hasNewPending ? '#FFF' : '#64748B', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 }}>
                                                {activeSubFilter === 'Return' ? 'DOWNLOAD NEW PENDING RETURNS' : 'DOWNLOAD NEW PENDING EXCHANGES'}
                                            </Text>
                                            <Download size={20} color={hasNewPending ? '#FFF' : '#64748B'} />
                                        </TouchableOpacity>
                                    );
                                })()}

                                {/* FULL WIDTH LIST */}
                                <View style={{ gap: 20 }}>
                                    {filteredShipments.map(shipment => renderShipmentCard(shipment))}

                                    {filteredShipments.length === 0 && (
                                        <Card style={{ backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', borderRadius: 24, padding: 40, alignItems: 'center', borderStyle: 'dashed' }}>
                                            <RotateCcw size={32} color="#64748B" style={{ marginBottom: 12 }} />
                                            <Text style={{ color: '#F8FAFC', fontSize: 16, fontWeight: '600' }}>No {activeSubFilter} Requests</Text>
                                            <Text style={{ color: '#64748B', fontSize: 13, textAlign: 'center', marginTop: 4 }}>All {activeSubFilter.toLowerCase()}s in this category have been processed.</Text>
                                        </Card>
                                    )}
                                </View>
                            </View>
                        ) : (
                            <View style={{ gap: 20 }}>
                                {filteredShipments.map(shipment => renderShipmentCard(shipment))}
                            </View>
                        )
                    )
                )
                }
                <View style={{ height: 80 }} />
            </ScrollView>

            {/* SCHEDULE RETURN MODAL */}
            <Modal visible={schedulingModalVisible} transparent animationType="fade">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <View style={{ width: '100%', backgroundColor: '#141e33', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#334155' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text style={{ color: '#F8FAFC', fontSize: 22, fontWeight: '900' }}>Schedule Return Pickup</Text>
                            <TouchableOpacity onPress={() => setSchedulingModalVisible(false)} style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(239, 68, 68, 0.15)', justifyContent: 'center', alignItems: 'center' }}>
                                <X size={20} color="#EF4444" strokeWidth={2.5} />
                            </TouchableOpacity>
                        </View>
                        <Text style={{ color: '#94A3B8', fontSize: 14, fontWeight: '600', marginBottom: 24 }}>
                            Assign a {assignmentMode === 'driver' ? 'delivery boy' : 'distributor'} for order #{selectedShipmentForModal?.orderId}
                        </Text>

                        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                            <TouchableOpacity
                                onPress={() => { setAssignmentMode('driver'); setSelectedBoy(null); }}
                                style={{ flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: assignmentMode === 'driver' ? '#7C3AED' : '#1e293b', alignItems: 'center', borderWidth: 1, borderColor: assignmentMode === 'driver' ? '#7C3AED' : '#334155' }}>
                                <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 12 }}>Delivery Boys</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => { setAssignmentMode('distributor'); setSelectedBoy(null); }}
                                style={{ flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: assignmentMode === 'distributor' ? '#7C3AED' : '#1e293b', alignItems: 'center', borderWidth: 1, borderColor: assignmentMode === 'distributor' ? '#7C3AED' : '#334155' }}>
                                <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 12 }}>Distributors</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={{ position: 'relative' }}>
                            <TouchableOpacity
                                onPress={() => setShowBoyDropdown(!showBoyDropdown)}
                                style={{ height: 52, backgroundColor: '#1e293b', paddingHorizontal: 16, borderRadius: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#334155' }}>
                                <Text style={{ color: '#F8FAFC', fontWeight: '700' }}>{selectedBoy ? selectedBoy.name : `Select a ${assignmentMode === 'driver' ? 'delivery boy' : 'distributor'} `}</Text>
                                <ChevronDown size={18} color="#94A3B8" strokeWidth={3} />
                            </TouchableOpacity>
                            {showBoyDropdown && (
                                <View style={{ position: 'absolute', bottom: 60, left: 0, right: 0, backgroundColor: '#1e293b', borderRadius: 16, borderWidth: 1, borderColor: '#334155', overflow: 'hidden', zIndex: 100 }}>
                                    <ScrollView style={{ maxHeight: 200 }}>
                                        {(assignmentMode === 'driver' ? deliveryBoys : distributors).length > 0 ? (
                                            (assignmentMode === 'driver' ? deliveryBoys : distributors).map((item) => (
                                                <TouchableOpacity
                                                    key={item.id}
                                                    onPress={() => handleAssign(item)}
                                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: '#334155' }}
                                                >
                                                    <User size={18} color="#94A3B8" />
                                                    <Text style={{ color: '#F8FAFC', fontWeight: '700' }}>{item.name}</Text>
                                                </TouchableOpacity>
                                            ))
                                        ) : (
                                            <View style={{ padding: 20, alignItems: 'center' }}>
                                                <Text style={{ color: '#94A3B8', fontSize: 12 }}>No {assignmentMode === 'driver' ? 'delivery boys' : 'distributors'} available</Text>
                                            </View>
                                        )}
                                    </ScrollView>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Full Image Preview Modal */}
            <Modal
                transparent={true}
                visible={!!selectedFullImage}
                animationType="fade"
                onRequestClose={() => setSelectedFullImage(null)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <TouchableOpacity
                        onPress={() => setSelectedFullImage(null)}
                        style={{ position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 12, backgroundColor: 'rgba(239, 68, 68, 0.3)', borderRadius: 25 }}
                    >
                        <X color="#FFF" size={24} strokeWidth={2.5} />
                    </TouchableOpacity>

                    {selectedFullImage && (
                        <TouchableOpacity
                            activeOpacity={1}
                            onPress={() => setSelectedFullImage(null)}
                            style={{ width: '100%', height: '80%', justifyContent: 'center', alignItems: 'center' }}
                        >
                            <Image
                                source={{ uri: selectedFullImage }}
                                style={{ width: '100%', height: '100%', borderRadius: 12 }}
                                resizeMode="contain"
                            />
                        </TouchableOpacity>
                    )}
                </View>
            </Modal>
        </View>
    );
}
