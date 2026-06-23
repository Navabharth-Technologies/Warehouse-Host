import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Truck, CheckCircle, Package, User, MapPin, ChevronRight, Circle, ChevronDown, Store, Navigation } from 'lucide-react-native';
import { BACKEND_URL } from '../config';
import LiveTracking from './LiveTracking';



// Mock Agencies (Keeping this as is for now)
const mockAgencies = [
    { id: 'a1', name: 'Blue Dart' },
    { id: 'a2', name: 'Shiprocket' },
    { id: 'a3', name: 'Delhivery' },
    { id: 'a4', name: 'Ecom Express' }
];

export function DistributionReady({ shipments = [], onAssignDelivery }) {
    const [selectedShipment, setSelectedShipment] = useState(null);
    const [deliveryType, setDeliveryType] = useState('own-delivery');
    const [driver, setDriver] = useState('');
    const [driverId, setDriverId] = useState('');

    const [selectedPartner, setSelectedPartner] = useState('');
    const [selectedAgency, setSelectedAgency] = useState('');
    const [showDriverDropdown, setShowDriverDropdown] = useState(false);

    const [showPartnerDropdown, setShowPartnerDropdown] = useState(false);
    const [showAgencyDropdown, setShowAgencyDropdown] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);


    const [drivers, setDrivers] = useState([]);
    const [distributors, setDistributors] = useState([]);

    // Fetch Drivers and Distributors on Mount
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch Drivers
                const driversResponse = await fetch(`${BACKEND_URL}/api/drivers`);
                if (driversResponse.ok) {
                    const driversData = await driversResponse.json();
                    setDrivers(driversData);
                }

                // Fetch Distributors
                const distributorsResponse = await fetch(`${BACKEND_URL}/api/distributors`);
                if (distributorsResponse.ok) {
                    const distributorsData = await distributorsResponse.json();
                    console.log("Fetched Distributors:", distributorsData.length);
                    setDistributors(distributorsData);
                }
            } catch (error) {
                console.error("Failed to fetch initial data:", error);
            }
        };
        fetchData();
    }, []);

    // Only show packages waiting for distribution assignment. 
    // Once assigned (ready-for-delivery), they move to the Transit tab.
    const packagedShipments = shipments.filter(s => s.status === 'packaged');

    const showAlert = (title, message) => {
        if (Platform.OS === 'web') {
            window.alert(`${title}: ${message}`);
        } else {
            Alert.alert(title, message);
        }
    };

    const handleAssign = async (shipmentId) => {
        console.log(">>> [UI ACTION] Confirm Dispatch clicked for:", shipmentId);

        if (deliveryType === 'own-delivery' && !driver) {
            console.warn(">>> [UI ERROR] Driver not selected");
            showAlert("Action Required", "Please select a driver for fleet delivery.");
            return;
        }

        if (deliveryType === 'partner' && !selectedPartner) {
            showAlert("Action Required", "Please select a distributor.");
            return;
        }

        if (deliveryType === 'third-party' && !selectedAgency) {
            showAlert("Action Required", "Please select a 3PL agency.");
            return;
        }

        let assigneeName = '';
        if (deliveryType === 'own-delivery') assigneeName = driver;
        else if (deliveryType === 'partner') assigneeName = selectedPartner;
        else assigneeName = selectedAgency;

        const targetShipment = shipments.find(s => s.id === shipmentId || s.orderId === shipmentId);
        const title = "Confirm Dispatch";
        const message = `Are you sure you want to assign ${assigneeName} for Order #${targetShipment?.orderId || shipmentId}?`;

        const startAssignment = async () => {
            let assignee = '';
            let details = '';
            let distributionData = {
                orderId: targetShipment?.orderId || shipmentId,
                deliveryType
            };

            if (deliveryType === 'own-delivery') {
                assignee = driver;
                details = 'Direct Route';
                distributionData.driverName = assignee;
                distributionData.driverId = driverId; // Pass the actual ID from the DB
                distributionData.routeName = details;
            } else if (deliveryType === 'partner') {
                assignee = selectedPartner;
                details = 'Partner Distributor';
                distributionData.partnerName = assignee;
            } else {
                assignee = selectedAgency;
                details = 'Third Party Logistics';
                distributionData.agencyName = assignee;
            }

            console.log(">>> [NETWORK FETCH] Sending to /api/distribution:", distributionData);

            setIsSubmitting(true);
            try {
                // Save to Backend (Logistics record)
                const response = await fetch(`${BACKEND_URL}/api/distribution`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(distributionData),
                });

                if (!response.ok) {
                    const errText = await response.text();
                    console.error(">>> [SERVER ERROR] Distribution creation failed:", errText);
                    showAlert("Dispatch Failed", "The server could not create the distribution record. See console for details.");
                    return;
                }

                console.log(">>> [SERVER SUCCESS] Distribution record created.");

                // Update Order Status (Primary DB)
                if (typeof onAssignDelivery === 'function') {
                    console.log(">>> [UPDATE STATUS] Updating order status to ready-for-delivery...");

                    const deliveryInfoUpdate = {
                        deliveryType,
                        route: details,
                        assignedDate: new Date().toLocaleString()
                    };

                    if (deliveryType === 'own-delivery') {
                        deliveryInfoUpdate.driver = assignee;
                        deliveryInfoUpdate.driverName = assignee;
                        deliveryInfoUpdate.driverId = driverId;
                    } else if (deliveryType === 'partner') {
                        deliveryInfoUpdate.partnerName = assignee;
                    } else if (deliveryType === 'third-party') {
                        deliveryInfoUpdate.agencyName = assignee;
                    }

                    await onAssignDelivery(shipmentId, deliveryInfoUpdate);
                    console.log(">>> [UPDATE SUCCESS] Order status updated.");
                    return;
                } else {
                    console.error(">>> [CONFIG ERROR] onAssignDelivery is not a function!");
                }

                // Fallback Cleanup
                setSelectedShipment(null);
                setDriver('');
                setSelectedPartner('');
                setSelectedAgency('');
                showAlert("Success", "Delivery assigned successfully.");

            } catch (error) {
                console.error(">>> [NETWORK ERROR] Failed to connect to backend:", error);
                showAlert("Network Error", "Cannot connect to the warehouse server. Please ensure the backend is running and reachable.");
            } finally {
                setIsSubmitting(false);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`${title}\n\n${message}`)) {
                await startAssignment();
            }
        } else {
            Alert.alert(
                title,
                message,
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Confirm", style: "default", onPress: () => startAssignment() }
                ]
            );
        }
    };

    const [trackingModalVisible, setTrackingModalVisible] = useState(false);
    const [trackingOrder, setTrackingOrder] = useState(null);

    // ... existing functions ...

    const handleTrack = (order) => {
        setTrackingOrder(order);
        setTrackingModalVisible(true);
    };

    return (
        <ScrollView style={{ flex: 1 }}>
            <LiveTracking
                visible={trackingModalVisible}
                onClose={() => setTrackingModalVisible(false)}
                orderId={trackingOrder?.orderId}
                driverName={trackingOrder?.deliveryInfo?.driver}
            />
            <View style={{ marginBottom: 24 }}>
                <Text style={{ fontSize: 26, fontWeight: '800', color: '#F8FAFC', marginBottom: 6, letterSpacing: -0.5 }}>Distribution Center</Text>
                <Text style={{ color: '#94A3B8', fontSize: 15 }}>Optimize last-mile delivery assignments</Text>
            </View>

            {packagedShipments.length === 0 ? (
                <Card style={{ backgroundColor: '#1e293b', borderWidth: 0, borderRadius: 24, padding: 40, alignItems: 'center' }}>
                    <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(148, 163, 184, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                        <Truck size={40} color="#94A3B8" />
                    </View>
                    <Text style={{ color: '#F8FAFC', fontSize: 18, fontWeight: '600' }}>Fleet is Fully Assigned</Text>
                    <Text style={{ color: '#64748B', fontSize: 14, textAlign: 'center', marginTop: 8 }}>No new packages awaiting delivery assignment.</Text>
                </Card>
            ) : (
                <View style={{ gap: 16 }}>
                    {packagedShipments.map((shipment) => (
                        <Card key={shipment.id} style={{ backgroundColor: '#1e293b', borderWidth: 0, borderRadius: 24, padding: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12 }}>
                            <CardHeader style={{ padding: 16, paddingBottom: 8 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <View>
                                        <CardTitle style={{ fontSize: 18, fontWeight: '700', color: '#F8FAFC' }}>Order #{shipment.orderId}</CardTitle>
                                        <Text style={{ color: '#CBD5E1', fontSize: 13, marginTop: 4 }}>Label: <Text style={{ color: '#F8FAFC', fontWeight: '800' }}>{shipment.packageInfo?.labelNumber || 'N/A'}</Text></Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', gap: 6 }}>
                                        <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(16, 185, 129, 0.1)', borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.2)' }}>
                                            <Text style={{ color: '#10B981', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>Ready</Text>
                                        </View>
                                    </View>
                                </View>
                            </CardHeader>
                            <CardContent style={{ padding: 16, paddingTop: 0 }}>
                                <View style={{ gap: 16, marginBottom: 16 }}>
                                    {/* Vendor Info */}
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>Vendor</Text>
                                            <Text style={{ color: '#F8FAFC', fontWeight: '600', fontSize: 14 }} numberOfLines={1}>{shipment.vendorName}</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(59, 130, 246, 0.1)', justifyContent: 'center', alignItems: 'center' }}>
                                                    <Store size={14} color="#3B82F6" strokeWidth={2.5} />
                                                </View>
                                                <Text style={{ color: '#3B82F6', fontSize: 12, fontWeight: '600' }} numberOfLines={1}>{shipment.vendorAddress}</Text>
                                            </View>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>Customer</Text>
                                            <Text style={{ color: '#F8FAFC', fontWeight: '600', fontSize: 14 }} numberOfLines={1}>{shipment.customerName}</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(16, 185, 129, 0.1)', justifyContent: 'center', alignItems: 'center' }}>
                                                    <User size={14} color="#10B981" strokeWidth={2.5} />
                                                </View>
                                                <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '600' }} numberOfLines={1}>{shipment.customerAddress}</Text>
                                            </View>
                                        </View>
                                    </View>

                                    {/* Stats Grid */}
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <View>
                                            <Text style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>Weight</Text>
                                            <Text style={{ color: '#F8FAFC', fontWeight: '600', fontSize: 14 }}>{shipment.packageInfo?.weight || '0'} kg</Text>
                                        </View>
                                    </View>

                                    {/* Items */}
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>Items</Text>
                                        <Text style={{ color: '#F8FAFC', fontWeight: '600', fontSize: 14 }} numberOfLines={2}>
                                            {shipment.items && shipment.items.length > 0
                                                ? shipment.items.map(i => i.name).join(', ')
                                                : '0 items'}
                                        </Text>
                                    </View>
                                </View>

                                {shipment.deliveryInfo ? (
                                    <View style={{ borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 16, gap: 10 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(124, 58, 237, 0.15)', justifyContent: 'center', alignItems: 'center' }}>
                                                <User size={16} color="#7C3AED" strokeWidth={2.5} />
                                            </View>
                                            <Text style={{ color: '#F8FAFC', fontWeight: '800' }}>{shipment.deliveryInfo.driver}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(124, 58, 237, 0.15)', justifyContent: 'center', alignItems: 'center' }}>
                                                <MapPin size={16} color="#7C3AED" strokeWidth={2.5} />
                                            </View>
                                            <Text style={{ color: '#94A3B8', fontWeight: '600' }}>{shipment.deliveryInfo.route}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                <CheckCircle size={14} color="#10B981" />
                                                <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '700' }}>Shipment En Route</Text>
                                            </View>
                                            <TouchableOpacity
                                                onPress={() => handleTrack(shipment)}
                                                style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#1e293b', borderRadius: 8, borderWidth: 1, borderColor: '#334155', flexDirection: 'row', gap: 6, alignItems: 'center' }}
                                            >
                                                <Navigation size={12} color="#7C3AED" />
                                                <Text style={{ color: '#F8FAFC', fontSize: 11, fontWeight: '600' }}>Track Live</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ) : (
                                    <>
                                        {selectedShipment === shipment.id ? (
                                            <View style={{ backgroundColor: '#0f172a', borderRadius: 16, padding: 16, marginTop: 0, borderWidth: 1, borderColor: '#334155' }}>
                                                <Text style={{ color: '#F8FAFC', fontWeight: '700', marginBottom: 12 }}>Assign Delivery</Text>

                                                {/* Delivery Type Tabs */}
                                                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                                                    {[
                                                        { id: 'own-delivery', label: 'Fleet' },
                                                        { id: 'partner', label: 'Distributor' },
                                                        { id: 'third-party', label: '3PL' }
                                                    ].map(type => (
                                                        <TouchableOpacity
                                                            key={type.id}
                                                            onPress={() => setDeliveryType(type.id)}
                                                            style={{
                                                                flex: 1,
                                                                paddingVertical: 8,
                                                                borderRadius: 8,
                                                                backgroundColor: deliveryType === type.id ? '#7C3AED' : '#1e293b',
                                                                alignItems: 'center',
                                                                borderWidth: 1,
                                                                borderColor: deliveryType === type.id ? '#7C3AED' : '#334155'
                                                            }}
                                                        >
                                                            <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '600' }}>{type.label}</Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>

                                                {/* Form Fields */}
                                                <View style={{ gap: 12, marginBottom: 20 }}>
                                                    {deliveryType === 'own-delivery' && (
                                                        <>
                                                            <View>
                                                                <Text style={{ color: '#94A3B8', fontSize: 11, marginBottom: 4 }}>Driver</Text>
                                                                <TouchableOpacity
                                                                    style={{ height: 44, backgroundColor: '#1e293b', borderRadius: 8, justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: '#334155' }}
                                                                    onPress={() => setShowDriverDropdown(!showDriverDropdown)}
                                                                >
                                                                    <Text style={{ color: driver ? '#FFF' : '#64748B' }}>{driver || 'Select Driver'}</Text>
                                                                </TouchableOpacity>
                                                                {showDriverDropdown && (
                                                                    <View style={{ marginTop: 4, backgroundColor: '#1e293b', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#334155' }}>
                                                                        {drivers.map(d => (
                                                                            <TouchableOpacity
                                                                                key={d.id}
                                                                                onPress={() => { setDriver(d.name); setDriverId(d.id); setShowDriverDropdown(false); }}
                                                                                style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#334155' }}
                                                                            >
                                                                                <Text style={{ color: '#FFF' }}>{d.name}</Text>
                                                                            </TouchableOpacity>
                                                                        ))}
                                                                    </View>
                                                                )}
                                                            </View>

                                                        </>
                                                    )}

                                                    {deliveryType === 'partner' && (
                                                        <View>
                                                            <Text style={{ color: '#94A3B8', fontSize: 11, marginBottom: 4 }}>Distributor</Text>
                                                            <TouchableOpacity
                                                                style={{ height: 44, backgroundColor: '#1e293b', borderRadius: 8, justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: '#334155' }}
                                                                onPress={() => setShowPartnerDropdown(!showPartnerDropdown)}
                                                            >
                                                                <Text style={{ color: selectedPartner ? '#FFF' : '#64748B' }}>{selectedPartner || 'Select Distributor'}</Text>
                                                            </TouchableOpacity>
                                                            {showPartnerDropdown && (
                                                                <View style={{ marginTop: 4, backgroundColor: '#1e293b', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#334155' }}>
                                                                    {distributors.map(d => (
                                                                        <TouchableOpacity
                                                                            key={d.id}
                                                                            onPress={() => { setSelectedPartner(d.name); setShowPartnerDropdown(false); }}
                                                                            style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#334155', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                                                                        >
                                                                            <View>
                                                                                <Text style={{ color: '#FFF', fontWeight: '600' }}>{d.name}</Text>
                                                                                <Text style={{ color: '#94A3B8', fontSize: 11 }}>{d.location || d.address || 'Address N/A'}</Text>
                                                                            </View>
                                                                        </TouchableOpacity>
                                                                    ))}
                                                                </View>
                                                            )}
                                                        </View>
                                                    )}

                                                    {deliveryType === 'third-party' && (
                                                        <View>
                                                            <Text style={{ color: '#94A3B8', fontSize: 11, marginBottom: 4 }}>Agency</Text>
                                                            <TouchableOpacity
                                                                style={{ height: 44, backgroundColor: '#1e293b', borderRadius: 8, justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: '#334155' }}
                                                                onPress={() => setShowAgencyDropdown(!showAgencyDropdown)}
                                                            >
                                                                <Text style={{ color: selectedAgency ? '#FFF' : '#64748B' }}>{selectedAgency || 'Select Agency'}</Text>
                                                            </TouchableOpacity>
                                                            {showAgencyDropdown && (
                                                                <View style={{ marginTop: 4, backgroundColor: '#1e293b', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#334155' }}>
                                                                    {mockAgencies.map(a => (
                                                                        <TouchableOpacity
                                                                            key={a.id}
                                                                            onPress={() => { setSelectedAgency(a.name); setShowAgencyDropdown(false); }}
                                                                            style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#334155' }}
                                                                        >
                                                                            <Text style={{ color: '#FFF' }}>{a.name}</Text>
                                                                        </TouchableOpacity>
                                                                    ))}
                                                                </View>
                                                            )}
                                                        </View>
                                                    )}
                                                </View>

                                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                                    <TouchableOpacity
                                                        style={{ flex: 1, height: 44, backgroundColor: '#7C3AED', borderRadius: 8, justifyContent: 'center', alignItems: 'center', opacity: isSubmitting ? 0.7 : 1 }}
                                                        onPress={() => !isSubmitting && handleAssign(shipment.id)}
                                                        disabled={isSubmitting}
                                                    >
                                                        <Text style={{ color: '#FFF', fontWeight: 'bold' }}>
                                                            {isSubmitting ? 'Processing...' : 'Confirm Dispatch'}
                                                        </Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={{ flex: 1, height: 44, backgroundColor: 'transparent', borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#475569' }}
                                                        onPress={() => setSelectedShipment(null)}
                                                    >
                                                        <Text style={{ color: '#94A3B8' }}>Cancel</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        ) : (
                                            <TouchableOpacity
                                                onPress={() => {
                                                    setSelectedShipment(shipment.id);
                                                    setDeliveryType('own-delivery');
                                                    setDriver('');
                                                    setDriverId('');

                                                    setSelectedPartner('');
                                                    setSelectedAgency('');
                                                }}
                                                style={{ height: 48, backgroundColor: '#8B5CF6', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 8 }}
                                            >
                                                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>Assign for Delivery</Text>
                                            </TouchableOpacity>
                                        )}
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </View>
            )}
        </ScrollView>
    );
}
