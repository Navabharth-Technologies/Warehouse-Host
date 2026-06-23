import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, Platform, Image, Linking, Alert } from 'react-native';
import { format, isSameDay, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Truck, MapPin, Phone, User, Package, Clock, CheckCircle, Eye, Navigation, X, Activity, ShieldCheck, ShieldAlert, ChevronRight, ChevronDown, Filter, Calendar as CalendarIcon, Store } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BACKEND_URL } from '../config';

export function TransitDelivery({ shipments = [], deliveryBoys = [], distributors = [] }) {
    console.log("TransitDelivery Render. Items:", shipments.length);

    // State for live transit data (enrichment)
    const [transitStatuses, setTransitStatuses] = useState({});
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('all');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState(null); // Default to null (show all)

    const dateInputRef = useRef(null);

    const handleDatePress = () => {
        if (Platform.OS === 'web' && dateInputRef.current) {
            try {
                if (dateInputRef.current.showPicker) {
                    dateInputRef.current.showPicker();
                } else {
                    dateInputRef.current.click(); // Fallback
                }
            } catch (error) {
                console.error("Error opening date picker:", error);
            }
        }
    };

    // Poll for real-time transit status enrichment
    useEffect(() => {
        const fetchTransitStatus = async () => {
            try {
                const response = await fetch(`${BACKEND_URL}/api/transit/transit-status`);
                if (response.ok) {
                    const data = await response.json();
                    // Create a map of orderId -> transit details
                    const statusMap = {};
                    data.forEach(item => {
                        statusMap[item.id] = item;
                    });
                    setTransitStatuses(statusMap);
                }
            } catch (error) {
                console.error("Error fetching transit status:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchTransitStatus();
        const interval = setInterval(fetchTransitStatus, 5000); // Live poll every 5s
        return () => clearInterval(interval);
    }, []);

    const [detailsModalVisible, setDetailsModalVisible] = useState(false);
    const [selectedDetailsOrder, setSelectedDetailsOrder] = useState(null);
    const [visiblePhones, setVisiblePhones] = useState({}); // State to toggle phone visibility inline

    const getDriverPhone = (driverName) => {
        if (!driverName) return null;
        const normalizedName = driverName.toString().trim().toLowerCase();
        let found = deliveryBoys.find(b =>
            (b.name && b.name.trim().toLowerCase() === normalizedName) ||
            (b.id && b.id.toString() === normalizedName) ||
            (b.phone && b.phone.toString() === normalizedName)
        );
        if (!found) {
            found = distributors.find(d =>
                (d.name && d.name.trim().toLowerCase() === normalizedName) ||
                (d.id && d.id.toString() === normalizedName) ||
                (d.phone && d.phone.toString() === normalizedName)
            );
        }
        if (found) return found.phone;

        // Fallback: If driverName itself looks like a phone number
        const phoneRegex = /^[0-9\s\+\-]{10,15}$/;
        if (phoneRegex.test(driverName.toString().trim())) {
            return driverName.toString().trim();
        }

        return null;
    };

    const handleCallDriver = (driverName) => {
        setVisiblePhones(prev => ({
            ...prev,
            [driverName]: !prev[driverName]
        }));
    };
    const [fullImage, setFullImage] = useState(null); // State for full-screen image viewing

    const openFullImage = (uri) => {
        setFullImage(uri);
    };

    const openDetails = (shipment) => {
        setSelectedDetailsOrder(shipment);
        setDetailsModalVisible(true);
    };

    // Filter relevant shipments from the main prop
    const relevantShipments = shipments.filter(s => {
        const st = (s.status || '').toLowerCase();
        // Include more statuses to ensure all rider-synced orders pass through
        return [
            'ready-for-delivery',
            'in-transit',
            'delivered',
            'failed',
            'out-for-delivery',
            'accepted',
            'pickedup',
            'assigned'
        ].includes(st);
    });

    // Group by driver safely
    const shipmentsByDriver = relevantShipments.reduce((acc, shipment) => {
        try {
            let matchesFilter = true;

            if (shipment && shipment.deliveryInfo) {
                // Parse if string
                const dInfo = typeof shipment.deliveryInfo === 'string' ? JSON.parse(shipment.deliveryInfo) : shipment.deliveryInfo;

                // Merge with live transit status if available
                const enrichedData = transitStatuses[shipment.id] || {};

                const enrichedShipment = {
                    ...shipment,
                    ...enrichedData, // Merge ALL enriched fields (transitStatus, paymentStatus, etc.)
                    warehouseStatus: shipment.status, // Preserve original warehouse status
                    deliveryInfo: dInfo,
                    id: shipment.id
                };

                // Identify the delivery agent for grouping
                // If it's a distributor shipment, group by the distributor's name (partnerName) directly,
                // instead of their delivery boy's name.
                let driver = 'Unknown Agent';
                if (dInfo && dInfo.deliveryType === 'partner') {
                    driver = dInfo.partnerName ? dInfo.partnerName.toString().trim() : 'Unknown Distributor';
                } else if (enrichedShipment.statusSource === 'distributor') {
                    driver = (dInfo && dInfo.partnerName) || enrichedShipment.deliveryBoyId || 'Unknown Distributor';
                } else if (enrichedShipment.deliveryBoyId) {
                    driver = enrichedShipment.deliveryBoyId.toString().trim();
                } else if (dInfo && dInfo.partnerName) {
                    driver = dInfo.partnerName.toString().trim();
                } else if (dInfo && dInfo.agencyName) {
                    driver = dInfo.agencyName.toString().trim();
                } else if (dInfo && (dInfo.driver || dInfo.driverName)) {
                    driver = (dInfo.driver || dInfo.driverName).toString().trim();
                }

                // Apply Filter
                // Determine status with terminal state priority: Warehouse Terminal > Transit Live > Warehouse Current
                const warehouseStatus = (shipment.status || '').toLowerCase().replace(/[^a-z]/g, '');
                const liveTransitStatus = (enrichedShipment.transitStatus || '').toLowerCase().replace(/[^a-z]/g, '');

                const isTerminal = ['delivered', 'failed', 'cancelled', 'returned'].includes(warehouseStatus);
                const currentStatus = isTerminal ? warehouseStatus : (liveTransitStatus || warehouseStatus);

                // Status Filter
                if (filterStatus === 'delivered') {
                    matchesFilter = currentStatus === 'delivered';
                } else if (filterStatus === 'failed') {
                    matchesFilter = currentStatus === 'failed' || currentStatus === 'cancelled';
                } else if (filterStatus === 'pending') {
                    // Match all active/in-transit statuses (excluding terminal states)
                    matchesFilter = !['delivered', 'failed', 'cancelled', 'returned'].includes(currentStatus);
                }

                // Date Filter
                if (matchesFilter && selectedDate) {
                    // checks updatedAt_Delivery, or updatedAt, or createdAt
                    const dateStr = enrichedShipment.updatedAt_Delivery || enrichedShipment.updatedAt || enrichedShipment.createdAt;
                    if (dateStr) {
                        const sDate = parseISO(dateStr);
                        if (!isSameDay(sDate, selectedDate)) {
                            matchesFilter = false;
                        }
                    }
                }

                if (matchesFilter) {
                    if (!acc[driver]) acc[driver] = [];
                    acc[driver].push(enrichedShipment);
                }
            } else if (shipment && shipment.statusSource === 'rider-only') {
                // Handle orders that come from rider DB but don't have warehouse deliveryInfo
                const enrichedShipment = shipment;
                const driver = enrichedShipment.deliveryBoyId || 'Unassigned Rider';

                const warehouseStatus = (enrichedShipment.status || '').toLowerCase().replace(/[^a-z]/g, '');
                const liveTransitStatus = (enrichedShipment.transitStatus || '').toLowerCase().replace(/[^a-z]/g, '');
                const isTerminal = ['delivered', 'failed', 'cancelled', 'returned'].includes(warehouseStatus);
                const currentStatus = isTerminal ? warehouseStatus : (liveTransitStatus || warehouseStatus);
                const enrichedWithWarehouse = { ...enrichedShipment, warehouseStatus: enrichedShipment.status };

                if (filterStatus === 'delivered') {
                    matchesFilter = currentStatus === 'delivered';
                } else if (filterStatus === 'failed') {
                    matchesFilter = currentStatus === 'failed' || currentStatus === 'cancelled';
                } else if (filterStatus === 'pending') {
                    matchesFilter = !['delivered', 'failed', 'cancelled', 'returned'].includes(currentStatus);
                }

                if (matchesFilter) {
                    if (!acc[driver]) acc[driver] = [];
                    acc[driver].push(enrichedWithWarehouse);
                }
            }
        } catch (e) {
            console.error("Error grouping shipment:", e, shipment);
        }
        return acc;
    }, {});



    const getStatusConfig = (status) => {
        const s = (status || '').toLowerCase().replace(/[^a-z]/g, '');
        if (s === 'delivered') return { label: 'Delivered', color: '#10B981', bg: 'rgba(16, 185, 129, 0.1)', icon: ShieldCheck };
        if (s === 'failed' || s === 'cancelled' || s === 'returned') return { label: 'Failed', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.1)', icon: ShieldAlert };
        if (s === 'accepted' || s === 'assigned' || s.includes('ready') || s === 'confirmed') return { label: 'Assigned', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.1)', icon: User };
        if (s === 'pickedup' || s.includes('transit') || s.includes('delivery')) return { label: 'In Transit', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.1)', icon: Truck };
        if (s === 'pending' || s === 'requested') return { label: 'Pending', color: '#7C3AED', bg: 'rgba(124, 58, 237, 0.1)', icon: Clock };

        return { label: 'Pending', color: '#7C3AED', bg: 'rgba(124, 58, 237, 0.1)', icon: Clock };
    };

    // Safely get coordinate strings
    const getLat = (loc) => (loc && (loc.lat || loc.latitude)) ? (loc.lat || loc.latitude).toFixed(4) : '?';
    const getLng = (loc) => (loc && (loc.lng || loc.longitude)) ? (loc.lng || loc.longitude).toFixed(4) : '?';

    return (
        <View style={{ flex: 1 }}>
            <ScrollView style={{ flex: 1 }}>
                <View style={{ marginBottom: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 10, paddingTop: 16 }}>
                    <View>
                        <Text style={{ fontSize: 26, fontWeight: '800', color: '#F8FAFC', marginBottom: 6, letterSpacing: -0.5 }}>Transit Monitor</Text>
                    </View>

                    {/* Filters Container */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, position: 'relative', zIndex: 20 }}>

                        {/* Date Picker Button */}
                        <View style={{ position: 'relative' }}>
                            <TouchableOpacity
                                onPress={handleDatePress}
                                activeOpacity={0.7}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 8,
                                    backgroundColor: '#1e293b',
                                    paddingHorizontal: 16,
                                    paddingVertical: 10,
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor: '#334155'
                                }}
                            >
                                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(124, 58, 237, 0.15)', justifyContent: 'center', alignItems: 'center', marginLeft: -6 }}>
                                    <CalendarIcon size={14} color="#7C3AED" strokeWidth={2.5} />
                                </View>
                                <Text style={{ color: '#F8FAFC', fontWeight: '700', fontSize: 13 }}>
                                    {selectedDate ? format(selectedDate, 'MMM dd, yyyy') : 'All Dates'}
                                </Text>
                                <ChevronDown size={14} color="#94A3B8" strokeWidth={3} />
                            </TouchableOpacity>

                            {/* Web Date Input (Hidden but Functional) */}
                            {Platform.OS === 'web' && React.createElement('input', {
                                ref: dateInputRef,
                                type: 'date',
                                value: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '',
                                onChange: (e) => {
                                    const val = e.target.value;
                                    if (!val) {
                                        setSelectedDate(null);
                                    } else {
                                        const d = new Date(val);
                                        if (!isNaN(d.getTime())) {
                                            setSelectedDate(d);
                                        }
                                    }
                                },
                                style: {
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: 1,
                                    height: 1,
                                    opacity: 0,
                                    pointerEvents: 'none', // We trigger programmatically
                                    zIndex: -1
                                }
                            })}
                        </View>

                        {/* Status Filter Dropdown */}
                        <View style={{ position: 'relative' }}>
                            <TouchableOpacity
                                onPress={() => setIsFilterOpen(!isFilterOpen)}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 8,
                                    backgroundColor: '#1e293b',
                                    paddingHorizontal: 16,
                                    paddingVertical: 10,
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor: '#334155'
                                }}
                            >
                                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(59, 130, 246, 0.15)', justifyContent: 'center', alignItems: 'center', marginLeft: -6 }}>
                                    <Filter size={14} color="#3B82F6" strokeWidth={2.5} />
                                </View>
                                <Text style={{ color: '#F8FAFC', fontWeight: '700', fontSize: 13, textTransform: 'capitalize' }}>
                                    {filterStatus === 'all' ? 'All Orders' : filterStatus}
                                </Text>
                                <ChevronDown size={14} color="#94A3B8" strokeWidth={3} />
                            </TouchableOpacity>

                            {isFilterOpen && (
                                <View style={{
                                    position: 'absolute',
                                    top: '120%',
                                    right: 0,
                                    width: 160,
                                    backgroundColor: '#1e293b',
                                    borderRadius: 16,
                                    padding: 8,
                                    borderWidth: 1,
                                    borderColor: '#334155',
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 10 },
                                    shadowOpacity: 0.3,
                                    shadowRadius: 20,
                                    elevation: 10
                                }}>
                                    {['all', 'pending', 'delivered', 'failed'].map((opt) => (
                                        <TouchableOpacity
                                            key={opt}
                                            onPress={() => {
                                                setFilterStatus(opt);
                                                setIsFilterOpen(false);
                                            }}
                                            style={{
                                                paddingVertical: 10,
                                                paddingHorizontal: 12,
                                                borderRadius: 8,
                                                backgroundColor: filterStatus === opt ? 'rgba(124, 58, 237, 0.1)' : 'transparent',
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'space-between'
                                            }}
                                        >
                                            <Text style={{
                                                color: filterStatus === opt ? '#7C3AED' : '#94A3B8',
                                                fontWeight: filterStatus === opt ? '700' : '500',
                                                textTransform: 'capitalize'
                                            }}>
                                                {opt === 'all' ? 'All Orders' : opt}
                                            </Text>
                                            {filterStatus === opt && <CheckCircle size={14} color="#7C3AED" />}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>
                    </View>
                </View>

                {loading ? (
                    <View style={{ alignItems: 'center', marginTop: 50 }}>
                        <Activity color="#7C3AED" size={32} />
                        <Text style={{ color: '#94A3B8', marginTop: 10 }}>Loading Live Status...</Text>
                    </View>
                ) : relevantShipments.length === 0 ? (
                    <Card style={{ backgroundColor: '#1e293b', borderWidth: 0, borderRadius: 24, padding: 40, alignItems: 'center' }}>
                        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(148, 163, 184, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                            <Navigation size={40} color="#94A3B8" />
                        </View>
                        <Text style={{ color: '#F8FAFC', fontSize: 18, fontWeight: '600' }}>No Active Shipments</Text>
                        <Text style={{ color: '#64748B', fontSize: 14, textAlign: 'center', marginTop: 8 }}>The fleet is currently idle or at the hub.</Text>
                    </Card>
                ) : (
                    <View style={{ gap: 20 }}>
                        {Object.entries(shipmentsByDriver).map(([driver, driverShipments]) => {
                            // Calculate active drops (not delivered or failed)
                            const activeDrops = driverShipments.filter(s => {
                                const status = (s.transitStatus || s.status || '').toLowerCase();
                                return status !== 'delivered' && status !== 'failed' && status !== 'cancelled';
                            }).length;

                            const isDist = driverShipments.some(s => s.statusSource === 'distributor' || (s.deliveryInfo && s.deliveryInfo.deliveryType === 'partner'));
                            const IconComponent = isDist ? Store : User;
                            const iconBgColor = isDist ? '#10B981' : '#7C3AED';

                            return (
                                <Card key={driver} style={{ backgroundColor: '#1e293b', borderWidth: 0, borderRadius: 24, padding: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12 }}>
                                    <CardHeader style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#334155' }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: iconBgColor, justifyContent: 'center', alignItems: 'center' }}>
                                                    <IconComponent size={24} color="#FFF" />
                                                </View>
                                                <View>
                                                    <Text style={{ color: '#F8FAFC', fontWeight: '800', fontSize: 16 }}>{driver}</Text>
                                                    {visiblePhones[driver] && (
                                                        <Text style={{ color: '#10B981', fontWeight: 'bold', fontSize: 15, marginTop: 2 }}>
                                                            {getDriverPhone(driver) || "No Phone Found"}
                                                        </Text>
                                                    )}
                                                    <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 4 }}>
                                                        {activeDrops} deliveries remaining
                                                    </Text>
                                                </View>
                                            </View>
                                            <TouchableOpacity
                                                onPress={() => handleCallDriver(driver)}
                                                style={{ padding: 8, backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: 10 }}
                                            >
                                                <Phone size={18} color="#10B981" />
                                            </TouchableOpacity>
                                        </View>
                                    </CardHeader>
                                    <CardContent style={{ padding: 16 }}>
                                        <View style={{ gap: 12 }}>
                                            {driverShipments.map((shipment) => {
                                                const warehouseStatus = (shipment.warehouseStatus || shipment.status || '').toLowerCase().replace(/[^a-z]/g, '');
                                                const liveTransitStatus = (shipment.transitStatus || '').toLowerCase().replace(/[^a-z]/g, '');
                                                const isTerminal = ['delivered', 'failed', 'cancelled', 'returned'].includes(warehouseStatus);
                                                const actualStatus = isTerminal ? warehouseStatus : (liveTransitStatus || warehouseStatus);
                                                const config = getStatusConfig(actualStatus);
                                                const borderColor = (!config || !config.color) ? '#333' : (config.color + '33');

                                                return (
                                                    <View key={shipment.id} style={{ backgroundColor: '#0f172a', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: borderColor }}>
                                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                                            <View>
                                                                <Text style={{ color: '#F8FAFC', fontWeight: '700', fontSize: 14 }}>Order #{shipment.orderId}</Text>
                                                            </View>
                                                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                                                <View style={{ backgroundColor: config.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                                    <config.icon size={12} color={config.color} />
                                                                    <Text style={{ color: config.color, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>{config.label}</Text>
                                                                </View>
                                                                {shipment.statusSource && (
                                                                    <View style={{ backgroundColor: 'rgba(148, 163, 184, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.2)' }}>
                                                                        <Text style={{ color: '#94A3B8', fontSize: 9, fontWeight: '700', textTransform: 'uppercase' }}>{shipment.statusSource}</Text>
                                                                    </View>
                                                                )}
                                                                <TouchableOpacity
                                                                    onPress={() => openDetails(shipment)}
                                                                    style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 }}
                                                                >
                                                                    <Text style={{ color: '#3B82F6', fontWeight: '700', fontSize: 12 }}>Details</Text>
                                                                </TouchableOpacity>

                                                            </View>
                                                        </View>

                                                        <View style={{ gap: 10 }}>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                                                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#334155' }}>
                                                                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#7C3AED' }} />
                                                                </View>
                                                                <Text style={{ color: '#94A3B8', fontSize: 11, flex: 1 }} numberOfLines={2}>{shipment.vendorName} - {shipment.vendorFullAddress || shipment.vendorAddress}</Text>
                                                            </View>
                                                            <View style={{ marginLeft: 11, width: 2, height: 10, backgroundColor: '#334155' }} />
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                                                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#334155' }}>
                                                                    <MapPin size={12} color="#10B981" />
                                                                </View>
                                                                <Text style={{ color: '#F8FAFC', fontSize: 11, fontWeight: '600', flex: 1 }} numberOfLines={1}>{shipment.customerAddress || 'Customer Destination'}</Text>
                                                            </View>
                                                        </View>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </View>
                )
                }
            </ScrollView >

            {/* Details Modal */}
            < Modal visible={detailsModalVisible} animationType="slide" transparent >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 }}>
                    <View style={{ backgroundColor: '#1e293b', borderRadius: 24, padding: 24, maxHeight: '80%', borderWidth: 1, borderColor: '#334155' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={{ fontSize: 20, fontWeight: '800', color: '#F8FAFC' }}>Delivery Details</Text>
                            <TouchableOpacity onPress={() => setDetailsModalVisible(false)} style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(239, 68, 68, 0.15)', justifyContent: 'center', alignItems: 'center' }}>
                                <X size={20} color="#EF4444" strokeWidth={2.5} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView>
                            {selectedDetailsOrder && (
                                <View style={{ gap: 16 }}>
                                    {/* Status Header */}
                                    <View style={{ backgroundColor: '#0f172a', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#334155', alignItems: 'center' }}>
                                        <Text style={{ color: '#94A3B8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Current Status</Text>
                                        <Text style={{ color: '#F8FAFC', fontSize: 24, fontWeight: '800', marginTop: 4 }}>
                                            {(() => {
                                                const w = (selectedDetailsOrder.warehouseStatus || selectedDetailsOrder.status || '').toLowerCase();
                                                const t = (selectedDetailsOrder.transitStatus || '').toLowerCase();
                                                if (['delivered', 'failed', 'cancelled', 'returned'].includes(w)) return w.charAt(0).toUpperCase() + w.slice(1);
                                                const s = t || w || 'N/A';
                                                return s.charAt(0).toUpperCase() + s.slice(1);
                                            })()}
                                        </Text>
                                        {selectedDetailsOrder.updatedAt_Delivery && (
                                            <Text style={{ color: '#64748B', fontSize: 12, marginTop: 4 }}>
                                                Last Updated: {new Date(selectedDetailsOrder.updatedAt_Delivery).toLocaleString()}
                                            </Text>
                                        )}
                                    </View>

                                    {/* Detailed Payment Info */}
                                    <View style={{ backgroundColor: '#0f172a', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#334155', gap: 12 }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <View>
                                                <Text style={{ color: '#94A3B8', fontSize: 11 }}>Total Amount</Text>
                                                <Text style={{ color: '#10B981', fontSize: 18, fontWeight: '700' }}>₹{selectedDetailsOrder.totalAmount}</Text>
                                            </View>
                                            <View style={{ alignItems: 'flex-end' }}>
                                                <Text style={{ color: '#94A3B8', fontSize: 11 }}>Payment Status</Text>
                                                <Text style={{ color: selectedDetailsOrder.paymentStatus === 'paid' ? '#10B981' : '#F59E0B', fontSize: 16, fontWeight: '600' }}>
                                                    {selectedDetailsOrder.paymentStatus || 'Pending'}
                                                </Text>
                                            </View>
                                        </View>

                                        <View style={{ height: 1, backgroundColor: '#334155' }} />

                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <View>
                                                <Text style={{ color: '#94A3B8', fontSize: 11 }}>Collected Amount</Text>
                                                <Text style={{ color: '#F8FAFC', fontSize: 14 }}>
                                                    {selectedDetailsOrder.collectedAmount !== null && selectedDetailsOrder.collectedAmount !== undefined
                                                        ? `₹${parseFloat(selectedDetailsOrder.collectedAmount).toFixed(2)}`
                                                        : '--'}
                                                </Text>
                                            </View>
                                            <View style={{ alignItems: 'flex-end' }}>
                                                <Text style={{ color: '#94A3B8', fontSize: 11 }}>Method</Text>
                                                <Text style={{ color: '#F8FAFC', fontSize: 14, textTransform: 'capitalize' }}>
                                                    {selectedDetailsOrder.paymentMethod || '--'}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>

                                    {/* Timeline Timestamps */}
                                    <View style={{ backgroundColor: '#0f172a', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#334155' }}>
                                        <Text style={{ color: '#94A3B8', fontSize: 11, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Event Log</Text>
                                        <View style={{ gap: 8 }}>
                                            {selectedDetailsOrder.acceptedAt && (
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                    <Text style={{ color: '#F8FAFC', fontSize: 13 }}>Accepted</Text>
                                                    <Text style={{ color: '#64748B', fontSize: 13 }}>
                                                        {(() => {
                                                            const d = new Date(selectedDetailsOrder.acceptedAt);
                                                            return isNaN(d.getTime()) ? selectedDetailsOrder.acceptedAt : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                                        })()}
                                                    </Text>
                                                </View>
                                            )}
                                            {(selectedDetailsOrder.pickedUpAt || selectedDetailsOrder.confirmedAt) && (
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                    <Text style={{ color: '#F8FAFC', fontSize: 13 }}>Picked Up</Text>
                                                    <Text style={{ color: '#64748B', fontSize: 13 }}>
                                                        {(() => {
                                                            const d = new Date(selectedDetailsOrder.pickedUpAt || selectedDetailsOrder.confirmedAt);
                                                            return isNaN(d.getTime()) ? (selectedDetailsOrder.pickedUpAt || selectedDetailsOrder.confirmedAt) : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                                        })()}
                                                    </Text>
                                                </View>
                                            )}
                                            {selectedDetailsOrder.deliveredAt && (
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                    <Text style={{ color: '#10B981', fontSize: 13, fontWeight: '700' }}>Delivered</Text>
                                                    <Text style={{ color: '#64748B', fontSize: 13 }}>
                                                        {(() => {
                                                            const d = new Date(selectedDetailsOrder.deliveredAt);
                                                            return isNaN(d.getTime()) ? selectedDetailsOrder.deliveredAt : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                                        })()}
                                                    </Text>
                                                </View>
                                            )}
                                            {selectedDetailsOrder.failedAt && (
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                    <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '700' }}>Failed</Text>
                                                    <Text style={{ color: '#64748B', fontSize: 13 }}>
                                                        {(() => {
                                                            const d = new Date(selectedDetailsOrder.failedAt);
                                                            return isNaN(d.getTime()) ? selectedDetailsOrder.failedAt : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                                        })()}
                                                    </Text>
                                                </View>
                                            )}
                                            {!(selectedDetailsOrder.acceptedAt || selectedDetailsOrder.pickedUpAt || selectedDetailsOrder.confirmedAt || selectedDetailsOrder.deliveredAt || selectedDetailsOrder.failedAt) && (
                                                <Text style={{ color: '#64748B', fontSize: 13, fontStyle: 'italic', textAlign: 'center' }}>No log history available</Text>
                                            )}
                                        </View>
                                    </View>

                                    {/* Locations */}
                                    <View style={{ backgroundColor: '#0f172a', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#334155', gap: 16 }}>
                                        <View>
                                            <Text style={{ color: '#7C3AED', fontSize: 12, fontWeight: '700', marginBottom: 4 }}>VENDOR</Text>
                                            <Text style={{ color: '#F8FAFC', fontWeight: '600' }}>{selectedDetailsOrder.vendorName}</Text>
                                            <Text style={{ color: '#94A3B8', fontSize: 13, marginTop: 2 }}>{selectedDetailsOrder.vendorAddress}</Text>
                                            <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>{selectedDetailsOrder.vendorContact}</Text>
                                        </View>
                                        <View style={{ height: 1, backgroundColor: '#334155' }} />
                                        <View>
                                            <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '700', marginBottom: 4 }}>CUSTOMER</Text>
                                            <Text style={{ color: '#F8FAFC', fontWeight: '600' }}>{selectedDetailsOrder.customerName}</Text>
                                            <Text style={{ color: '#94A3B8', fontSize: 13, marginTop: 2 }}>{selectedDetailsOrder.customerAddress}</Text>
                                            <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>{selectedDetailsOrder.customerContact}</Text>
                                        </View>
                                    </View>

                                    {/* Proofs / Failure Reasons */}
                                    {(selectedDetailsOrder.deliveryProof || selectedDetailsOrder.failureReason) && (
                                        <View style={{ backgroundColor: '#0f172a', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#334155' }}>
                                            <Text style={{ color: '#F8FAFC', fontWeight: '700', marginBottom: 8 }}>Delivery Updates</Text>
                                            {selectedDetailsOrder.failureReason && (
                                                <View style={{ marginBottom: 8 }}>
                                                    <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '700' }}>Failure Reason:</Text>
                                                    <Text style={{ color: '#F8FAFC' }}>{selectedDetailsOrder.failureReason}</Text>
                                                </View>
                                            )}
                                            {selectedDetailsOrder.deliveryProof && (
                                                <View style={{ marginTop: 8 }}>
                                                    <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '700', marginBottom: 4 }}>Delivery Proof:</Text>
                                                    <TouchableOpacity onPress={() => openFullImage(selectedDetailsOrder.deliveryProof)}>
                                                        <Image
                                                            source={{ uri: selectedDetailsOrder.deliveryProof }}
                                                            style={{ width: 100, height: 100, borderRadius: 8, backgroundColor: '#334155', borderWidth: 1, borderColor: '#475569' }}
                                                            resizeMode="cover"
                                                        />
                                                    </TouchableOpacity>
                                                </View>
                                            )}
                                            {selectedDetailsOrder.failurePhoto && (
                                                <View style={{ marginTop: 8 }}>
                                                    <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '700', marginBottom: 4 }}>Failure Photo:</Text>
                                                    <TouchableOpacity onPress={() => openFullImage(selectedDetailsOrder.failurePhoto)}>
                                                        <Image
                                                            source={{ uri: selectedDetailsOrder.failurePhoto }}
                                                            style={{ width: 100, height: 100, borderRadius: 8, backgroundColor: '#334155', borderWidth: 1, borderColor: '#475569' }}
                                                            resizeMode="cover"
                                                        />
                                                    </TouchableOpacity>
                                                </View>
                                            )}
                                        </View>
                                    )}

                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Full Image Modal */}
            <Modal visible={!!fullImage} animationType="fade" transparent>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>

                    <TouchableOpacity
                        onPress={() => setFullImage(null)}
                        style={{ position: 'absolute', top: 40, right: 20, zIndex: 20, padding: 10, backgroundColor: 'rgba(239, 68, 68, 0.3)', borderRadius: 20 }}
                    >
                        <X size={24} color="#FFF" strokeWidth={2.5} />
                    </TouchableOpacity>

                    {fullImage && (
                        <Image
                            source={{ uri: fullImage }}
                            style={{ width: '100%', height: '80%' }}
                            resizeMode="contain"
                        />
                    )}
                </View>
            </Modal>

        </View>
    );
}
