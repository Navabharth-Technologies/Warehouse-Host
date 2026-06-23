import React, { useState, useMemo, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform, Modal } from 'react-native';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Truck, Store, MapPin, Calendar, Package, ArrowLeft, ChevronRight, User, Building2, Calendar as CalendarIcon, X, ChevronLeft, ChevronDown } from 'lucide-react-native';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, parseISO, startOfWeek, endOfWeek } from 'date-fns';

export function DeliveryHistory({ shipments = [], returnShipments = [] }) {
    const [activeTab, setActiveTab] = useState('fleet'); // 'fleet', 'distributor', or 'vendor'
    const [historyType, setHistoryType] = useState('orders'); // 'orders', 'returns', 'exchange'
    const [selectedEntity, setSelectedEntity] = useState(null); // The selected driver or distributor name
    const [filterStatus, setFilterStatus] = useState('delivered');
    const [selectedDate, setSelectedDate] = useState(null);
    const [showCalendar, setShowCalendar] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const dateInputRef = useRef(null);

    const handleDatePress = () => {
        if (Platform.OS === 'web' && dateInputRef.current) {
            try {
                if (dateInputRef.current.showPicker) {
                    dateInputRef.current.showPicker();
                } else {
                    dateInputRef.current.click();
                }
            } catch (error) {
                console.error("Error opening date picker:", error);
            }
        } else {
            setShowCalendar(true);
        }
    };

    // Helper to extract safe delivery info (handle partial/double strings)
    const getDeliveryInfo = (order) => {
        let info = order.deliveryInfo;
        if (!info) return {};
        if (typeof info === 'object') return info;
        // Recursive parsing for double-encoded JSON
        try {
            const parsed = JSON.parse(info);
            return typeof parsed === 'string' ? getDeliveryInfo({ deliveryInfo: parsed }) : parsed;
        } catch (e) { return {}; }
    };

    // Group delivered orders by Fleet (Driver) and Distributor
    const groupedHistory = useMemo(() => {
        const groups = { fleet: {}, distributor: {}, vendor: {} };

        let rawData = [];
        if (historyType === 'orders') {
            rawData = shipments.filter(s => ['delivered', 'failed', 'ready-for-delivery'].includes(s.status));
        } else {
            const reqType = historyType === 'returns' ? 'Return' : 'Exchange';
            rawData = returnShipments.filter(s => {
                const sType = s.returnInfo.requestType || 'Return';
                // Only show returns/exchanges that are assigned or completed
                const isHistory = ['assigned', 'in-transit', 'received'].includes(s.returnInfo.status);
                return sType === reqType && isHistory;
            });
        }

        rawData.forEach(order => {
            // Date Filter
            let matchesDate = true;
            if (selectedDate) {
                matchesDate = false;
                const dateFields = historyType === 'orders' ? ['updatedAt', 'deliveryDate', 'createdAt'] : ['updatedAt', 'requestDate', 'createdAt'];
                for (const field of dateFields) {
                    if (order[field] || (order.returnInfo && order.returnInfo.requestDate && field === 'requestDate')) {
                        try {
                            const dateVal = (field === 'requestDate' && order.returnInfo) ? order.returnInfo.requestDate : order[field];
                            // Parse "DD/MM/YYYY" format used in returnInfo.requestDate if needed
                            let d;
                            if (typeof dateVal === 'string' && dateVal.includes('/')) {
                                const [dd, mm, yyyy] = dateVal.split('/');
                                d = new Date(yyyy, mm - 1, dd);
                            } else {
                                d = parseISO(dateVal);
                            }

                            if (isSameDay(d, selectedDate)) {
                                matchesDate = true;
                                break;
                            }
                        } catch (e) { }
                    }
                }
            }
            if (!matchesDate) return;

            let type, entityName, status, totalAmount;
            if (historyType === 'orders') {
                const info = getDeliveryInfo(order);
                type = info.deliveryType || 'own-delivery';
                entityName = type === 'own-delivery' ? (info.driver || info.driverName || 'Unknown Driver') : (info.partnerName || info.distributorName || 'Unknown Distributor');
                status = order.status;
                totalAmount = parseFloat(order.totalAmount) || 0;
            } else {
                // Determine if it's partner (distributor) or fleet (own-delivery)
                const distName = order.returnInfo.distributorName;
                const driverName = order.returnInfo.driverName;
                const isActuallyDist = (distName && distName !== 'Unknown' && distName !== 'Unknown Distributor') ||
                    (driverName && driverName.toLowerCase().includes('distributor'));

                type = isActuallyDist ? 'partner' : 'own-delivery';
                entityName = isActuallyDist ? (distName || driverName) : (driverName || 'Unknown Driver');
                status = order.returnInfo.status === 'received' ? 'delivered' : (order.returnInfo.status === 'assigned' ? 'ready-for-delivery' : order.returnInfo.status);
                totalAmount = parseFloat(order.totalAmount) || 0;
            }

            const rawDate = order.updatedAt ? new Date(order.updatedAt) : new Date();
            const enrichedOrder = {
                ...order,
                parsedItems: historyType === 'orders' ? (Array.isArray(order.items) ? order.items : (typeof order.items === 'string' ? JSON.parse(order.items) : [])) : [{ name: order.returnInfo.productName, quantity: order.returnInfo.returnExchangeQuantity || order.returnInfo.returnQuantity || 1 }],
                completionDate: rawDate.toLocaleDateString(),
                completionTime: rawDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                displayStatus: status,
                displayAmount: totalAmount,
                isRefund: historyType === 'returns' ? order.returnInfo?.isRefund : order.isRefund
            };

            function updateEntityStats(groupObj, name) {
                if (!groupObj[name]) {
                    groupObj[name] = {
                        orders: [], delivered: 0, failed: 0, assigned: 0,
                        paid: 0, pending: 0, paidAmount: 0, pendingAmount: 0,
                        refunds: 0, refundAmount: 0
                    };
                }
                const data = groupObj[name];
                data.orders.push(enrichedOrder);

                const lowerStatusVal = (status || '').toLowerCase();
                if (lowerStatusVal === 'delivered') data.delivered++;
                else if (lowerStatusVal === 'failed') data.failed++;
                else if (lowerStatusVal === 'ready-for-delivery') data.assigned++;

                if (historyType === 'orders') {
                    // Determine actual payment status depending on the entity group
                    let actualPaymentStatus = 'pending';
                    if (groupObj === groups.vendor) {
                        actualPaymentStatus = enrichedOrder.vendorPaymentStatus || 'pending';
                    } else if (type === 'partner') {
                        actualPaymentStatus = enrichedOrder.distributorPaymentStatus || enrichedOrder.paymentStatus || 'pending';
                    } else {
                        actualPaymentStatus = enrichedOrder.paymentStatus || 'pending';
                    }

                    const lowerStatus = actualPaymentStatus.toLowerCase();
                    if (lowerStatus === 'paid') {
                        data.paid++;
                        data.paidAmount += totalAmount;
                    } else if (lowerStatus === 'refunded' || enrichedOrder.isRefund == 1) {
                        data.refunds++;
                        data.refundAmount += totalAmount;
                    } else {
                        data.pending++;
                        data.pendingAmount += totalAmount;
                    }
                } else {
                    data.refunds++;
                    data.refundAmount += totalAmount;
                }
            };

            // Update respective groups
            const targetTypeGroup = type === 'own-delivery' ? groups.fleet : groups.distributor;
            updateEntityStats(targetTypeGroup, entityName);

            // Always update vendor group
            const currentVendor = order.vendorName || 'Unknown Vendor';
            updateEntityStats(groups.vendor, currentVendor);
        });

        // Sort orders descending by date for each group
        Object.keys(groups.fleet).forEach(key => {
            groups.fleet[key].orders.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
        });
        Object.keys(groups.distributor).forEach(key => {
            groups.distributor[key].orders.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
        });
        Object.keys(groups.vendor).forEach(key => {
            groups.vendor[key].orders.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
        });

        return groups;
    }, [shipments, returnShipments, historyType, selectedDate]);

    const handleBack = () => {
        setSelectedEntity(null);
    };

    // --- Detail View: List of Orders for a specific Entity ---
    // --- Detail View: List of Orders for a specific Entity ---
    if (selectedEntity) {
        const entityData = groupedHistory[activeTab][selectedEntity] || { orders: [] };
        const entityOrders = entityData.orders;
        const filteredOrders = entityOrders.filter(o => {
            if (activeTab === 'vendor') {
                const payStatus = (o.vendorPaymentStatus || 'pending').toLowerCase();
                const isRet = !!o.returnInfo;
                if (filterStatus === 'pending') return !isRet && payStatus !== 'paid' && payStatus !== 'refunded' && o.isRefund != 1;
                if (filterStatus === 'paid') return !isRet && payStatus === 'paid';
                if (filterStatus === 'refunded') return isRet || payStatus === 'refunded' || o.isRefund == 1;
                return true;
            }
            const status = (o.displayStatus || '').toLowerCase();
            return filterStatus === 'delivered' ? status === 'delivered' || status === 'ready-for-delivery' : status === 'failed';
        });
        const totalValue = filteredOrders.reduce((sum, o) => sum + (parseFloat(o.displayAmount) || 0), 0);

        // Calendar Components
        const renderCalendar = () => {
            const start = startOfWeek(startOfMonth(currentMonth));
            const end = endOfWeek(endOfMonth(currentMonth));
            const days = eachDayOfInterval({ start, end });

            return (
                <Modal visible={showCalendar} transparent animationType="fade">
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }}>
                        <View style={{ backgroundColor: '#1e293b', padding: 20, borderRadius: 16, width: 340, borderWidth: 1, borderColor: '#334155' }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                <TouchableOpacity onPress={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                                    <ChevronLeft color="#F8FAFC" />
                                </TouchableOpacity>
                                <Text style={{ color: '#F8FAFC', fontWeight: '700', fontSize: 16 }}>
                                    {format(currentMonth, 'MMMM yyyy')}
                                </Text>
                                <TouchableOpacity onPress={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                                    <ChevronRight color="#F8FAFC" />
                                </TouchableOpacity>
                            </View>

                            {/* Day Labels Row */}
                            <View style={{ flexDirection: 'row', marginBottom: 10 }}>
                                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                                    <Text key={d} style={{ width: 42, textAlign: 'center', color: '#64748B', fontSize: 12 }}>{d}</Text>
                                ))}
                            </View>

                            {/* Day Numbers Grid */}
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                                {days.map((day, idx) => {
                                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                                    const isCurrentMonth = isSameMonth(day, currentMonth);
                                    return (
                                        <TouchableOpacity
                                            key={idx}
                                            onPress={() => { setSelectedDate(day); setShowCalendar(false); }}
                                            style={{
                                                width: 42,
                                                height: 40,
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                                backgroundColor: isSelected ? '#3B82F6' : 'transparent',
                                                borderRadius: 20
                                            }}>
                                            <Text style={{
                                                color: isSelected ? '#FFF' : (isCurrentMonth ? '#F8FAFC' : '#475569'),
                                                fontWeight: isSelected ? '700' : '400'
                                            }}>
                                                {format(day, 'd')}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
                                <TouchableOpacity onPress={() => { setSelectedDate(null); setShowCalendar(false); }}>
                                    <Text style={{ color: '#EF4444' }}>Clear</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setShowCalendar(false)}>
                                    <Text style={{ color: '#94A3B8' }}>Close</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            );
        };

        return (
            <ScrollView style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingTop: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <TouchableOpacity
                            onPress={handleBack}
                            style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#475569', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 }}
                        >
                            <ArrowLeft size={22} color="#FFFFFF" strokeWidth={3} />
                        </TouchableOpacity>
                        <View>
                            <Text style={{ fontSize: 20, fontWeight: '800', color: '#F8FAFC' }}>{selectedEntity}</Text>
                            <Text style={{ color: '#94A3B8', fontSize: 13 }}>
                                {filteredOrders.length} {filterStatus} • ₹{totalValue.toLocaleString()}
                            </Text>
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        {/* Date Picker Button - Match Cash Page Style */}
                        <View style={{ position: 'relative' }}>
                            <TouchableOpacity
                                onPress={handleDatePress}
                                activeOpacity={0.7}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 8,
                                    backgroundColor: '#1e293b',
                                    paddingHorizontal: 12,
                                    paddingVertical: 8,
                                    borderRadius: 10,
                                    borderWidth: 1,
                                    borderColor: '#334155'
                                }}
                            >
                                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(59, 130, 246, 0.15)', justifyContent: 'center', alignItems: 'center', marginLeft: -4 }}>
                                    <CalendarIcon size={14} color="#3B82F6" strokeWidth={2.5} />
                                </View>
                                <Text style={{ color: '#F8FAFC', fontWeight: '800', fontSize: 13 }}>
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
                                    position: 'absolute', top: 0, left: 0, width: 1, height: 1, opacity: 0, pointerEvents: 'none', zIndex: -1
                                }
                            })}
                        </View>

                        {/* Filter Toggle */}
                        <View style={{ flexDirection: 'row', backgroundColor: '#334155', borderRadius: 8, padding: 4 }}>
                            {activeTab === 'vendor' ? (
                                <>
                                    <TouchableOpacity
                                        onPress={() => setFilterStatus('pending')}
                                        style={{
                                            paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
                                            backgroundColor: filterStatus === 'pending' ? '#f97316' : 'transparent'
                                        }}
                                    >
                                        <Text style={{ color: filterStatus === 'pending' ? '#FFF' : '#94A3B8', fontSize: 12, fontWeight: '700' }}>Pending Payment</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => setFilterStatus('paid')}
                                        style={{
                                            paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
                                            backgroundColor: filterStatus === 'paid' ? '#10B981' : 'transparent'
                                        }}
                                    >
                                        <Text style={{ color: filterStatus === 'paid' ? '#FFF' : '#94A3B8', fontSize: 12, fontWeight: '700' }}>Paid</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => setFilterStatus('refunded')}
                                        style={{
                                            paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
                                            backgroundColor: filterStatus === 'refunded' ? '#ef4444' : 'transparent'
                                        }}
                                    >
                                        <Text style={{ color: filterStatus === 'refunded' ? '#FFF' : '#94A3B8', fontSize: 12, fontWeight: '700' }}>Refund</Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <>
                                    <TouchableOpacity
                                        onPress={() => setFilterStatus('delivered')}
                                        style={{
                                            paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
                                            backgroundColor: filterStatus === 'delivered' ? '#10B981' : 'transparent'
                                        }}
                                    >
                                        <Text style={{ color: filterStatus === 'delivered' ? '#FFF' : '#94A3B8', fontSize: 12, fontWeight: '600' }}>Success/Assigned</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => setFilterStatus('failed')}
                                        style={{
                                            paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
                                            backgroundColor: filterStatus === 'failed' ? '#ef4444' : 'transparent'
                                        }}
                                    >
                                        <Text style={{ color: filterStatus === 'failed' ? '#FFF' : '#94A3B8', fontSize: 12, fontWeight: '600' }}>Failed</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    </View>
                </View>

                {/* Cash Summary Cards */}
                {(activeTab === 'distributor' || activeTab === 'vendor') && (
                    <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                        {/* Pending Cash Card */}
                        <View style={{
                            flex: 1,
                            backgroundColor: '#1e293b',
                            borderRadius: 16,
                            padding: 16,
                            borderLeftWidth: 4,
                            borderLeftColor: '#f97316'
                        }}>
                            <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '600', marginBottom: 8 }}>PENDING CASH</Text>
                            <Text style={{ color: '#f97316', fontSize: 24, fontWeight: '800', letterSpacing: -0.5 }}>
                                ₹{entityData.pendingAmount?.toLocaleString() || '0'}
                            </Text>
                            <Text style={{ color: '#64748B', fontSize: 11, marginTop: 4 }}>
                                {entityData.pending || 0} orders pending
                            </Text>
                        </View>

                        {/* Paid Cash Card */}
                        <View style={{
                            flex: 1,
                            backgroundColor: '#1e293b',
                            borderRadius: 16,
                            padding: 16,
                            borderLeftWidth: 4,
                            borderLeftColor: '#22c55e'
                        }}>
                            <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '600', marginBottom: 8 }}>PAID CASH</Text>
                            <Text style={{ color: '#22c55e', fontSize: 24, fontWeight: '800', letterSpacing: -0.5 }}>
                                ₹{entityData.paidAmount?.toLocaleString() || '0'}
                            </Text>
                            <Text style={{ color: '#64748B', fontSize: 11, marginTop: 4 }}>
                                {entityData.paid || 0} orders paid
                            </Text>
                        </View>

                        {/* Refund Card (Only for Vendor) */}
                        {activeTab === 'vendor' && (
                            <View style={{
                                flex: 1,
                                backgroundColor: '#1e293b',
                                borderRadius: 16,
                                padding: 16,
                                borderLeftWidth: 4,
                                borderLeftColor: '#ef4444'
                            }}>
                                <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '600', marginBottom: 8 }}>REFUNDED</Text>
                                <Text style={{ color: '#ef4444', fontSize: 24, fontWeight: '800', letterSpacing: -0.5 }}>
                                    ₹{entityData.refundAmount?.toLocaleString() || '0'}
                                </Text>
                                <Text style={{ color: '#64748B', fontSize: 11, marginTop: 4 }}>
                                    {entityData.refunds || 0} orders
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                {renderCalendar()}

                <View style={{ gap: 16 }}>
                    {filteredOrders.length === 0 ? (
                        <View style={{ alignItems: 'center', padding: 40 }}>
                            <View style={{ backgroundColor: 'rgba(148, 163, 184, 0.1)', padding: 20, borderRadius: 30, marginBottom: 16 }}>
                                <Package size={48} color="#94A3B8" strokeWidth={1.5} />
                            </View>
                            <Text style={{ color: '#94A3B8' }}>No {filterStatus} orders found {selectedDate ? 'for this date' : ''}.</Text>
                        </View>
                    ) : (
                        filteredOrders.map((order) => (
                            <Card key={order.id} style={{ backgroundColor: '#1e293b', borderWidth: 0, borderRadius: 16 }}>
                                <CardHeader style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 12 }}>
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                            <CardTitle style={{ color: '#F8FAFC', fontSize: 16 }}>
                                                {historyType === 'orders' ? `Order #${order.orderId || order.orderNumber}` : `Return #${order.returnId || order.orderId}`}
                                            </CardTitle>

                                            {/* Status Badge */}
                                            <View style={{
                                                paddingHorizontal: 8,
                                                paddingVertical: 2,
                                                borderRadius: 6,
                                                backgroundColor: order.displayStatus === 'delivered' ? 'rgba(16, 185, 129, 0.1)' :
                                                    (order.displayStatus === 'failed' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)'),
                                                borderWidth: 1,
                                                borderColor: order.displayStatus === 'delivered' ? 'rgba(16, 185, 129, 0.2)' :
                                                    (order.displayStatus === 'failed' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)')
                                            }}>
                                                <Text style={{
                                                    color: order.displayStatus === 'delivered' ? '#10B981' :
                                                        (order.displayStatus === 'failed' ? '#ef4444' : '#3B82F6'),
                                                    fontSize: 10,
                                                    fontWeight: '700',
                                                    textTransform: 'uppercase'
                                                }}>
                                                    {order.displayStatus === 'ready-for-delivery' ? 'Assigned' :
                                                        order.displayStatus === 'delivered' ? (historyType === 'orders' ? 'Delivered' : 'Received in Hub') :
                                                            order.displayStatus === 'failed' ? 'Failed' :
                                                                order.displayStatus.charAt(0).toUpperCase() + order.displayStatus.slice(1)}
                                                </Text>
                                            </View>

                                            {/* Payment Badge */}
                                            <View style={{
                                                paddingHorizontal: 8,
                                                paddingVertical: 2,
                                                borderRadius: 6,
                                                backgroundColor: (() => {
                                                    const s = (activeTab === 'vendor' ? (order.vendorPaymentStatus || 'pending') : (activeTab === 'distributor' ? (order.distributorPaymentStatus || 'pending') : ((order.paymentStatus || '').toLowerCase() === 'paid' ? 'Paid' : 'pending'))).toLowerCase();
                                                    if (s === 'paid') return 'rgba(34, 197, 94, 0.1)';
                                                    if (s === 'refunded') return 'rgba(239, 68, 68, 0.1)';
                                                    return 'rgba(249, 115, 22, 0.1)';
                                                })(),
                                                borderWidth: 1,
                                                borderColor: (() => {
                                                    const s = (activeTab === 'vendor' ? (order.vendorPaymentStatus || 'pending') : (activeTab === 'distributor' ? (order.distributorPaymentStatus || 'pending') : ((order.paymentStatus || '').toLowerCase() === 'paid' ? 'Paid' : 'pending'))).toLowerCase();
                                                    if (s === 'paid') return 'rgba(34, 197, 94, 0.2)';
                                                    if (s === 'refunded') return 'rgba(239, 68, 68, 0.2)';
                                                    return 'rgba(249, 115, 22, 0.2)';
                                                })()
                                            }}>
                                                <Text style={{
                                                    color: (() => {
                                                        const s = (activeTab === 'vendor' ? (order.vendorPaymentStatus || 'pending') : (activeTab === 'distributor' ? (order.distributorPaymentStatus || 'pending') : ((order.paymentStatus || '').toLowerCase() === 'paid' ? 'Paid' : 'pending'))).toLowerCase();
                                                        if (s === 'paid') return '#22c55e';
                                                        if (s === 'refunded') return '#ef4444';
                                                        return '#f97316';
                                                    })(),
                                                    fontSize: 10,
                                                    fontWeight: '700',
                                                    textTransform: 'uppercase'
                                                }}>
                                                    {activeTab === 'vendor' ? (order.vendorPaymentStatus || 'Pending') : (activeTab === 'distributor' ? (order.distributorPaymentStatus || 'Pending') : (order.paymentStatus === 'COD' ? 'Pending' : (order.paymentStatus || 'Pending')))}
                                                </Text>
                                            </View>

                                            {/* Refund Status Badge (Only for Vendor returns/refunds) */}
                                            {activeTab === 'vendor' && order.isRefund && order.isRefund !== 'N/A' && (
                                                <View style={{
                                                    paddingHorizontal: 8,
                                                    paddingVertical: 2,
                                                    borderRadius: 6,
                                                    backgroundColor: order.isRefund === 'Refunded' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                    borderWidth: 1,
                                                    borderColor: order.isRefund === 'Refunded' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'
                                                }}>
                                                    <Text style={{
                                                        color: order.isRefund === 'Refunded' ? '#22c55e' : '#ef4444',
                                                        fontSize: 10,
                                                        fontWeight: '700',
                                                        textTransform: 'uppercase'
                                                    }}>
                                                        {order.isRefund}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>

                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 }}>
                                            <View style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: 4, borderRadius: 6 }}>
                                                <Calendar size={12} color="#3B82F6" strokeWidth={2.5} />
                                            </View>
                                            <Text style={{ color: '#94A3B8', fontSize: 13 }}>
                                                {order.completionDate} at {order.completionTime}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text style={{ color: '#F8FAFC', fontWeight: '800', fontSize: 18, marginLeft: 8 }}>₹{order.displayAmount}</Text>
                                </CardHeader>

                                <View style={{ height: 1, backgroundColor: '#334155', marginHorizontal: 16 }} />

                                <CardContent style={{ paddingTop: 12, gap: 12 }}>
                                    {order.displayStatus === 'failed' && (
                                        <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 8, borderRadius: 8, marginBottom: 8 }}>
                                            <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '600' }}>Reason: {order.failureReason || 'Unknown'}</Text>
                                        </View>
                                    )}
                                    {historyType !== 'orders' && order.returnInfo && (
                                        <View style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: 8, borderRadius: 8, marginBottom: 8 }}>
                                            <Text style={{ color: '#3B82F6', fontSize: 12, fontWeight: '600' }}>Return Reason: {order.returnInfo.reason || 'N/A'}</Text>
                                        </View>
                                    )}
                                    <View style={{ flexDirection: 'row', gap: 12 }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: '#64748B', fontSize: 11, marginBottom: 2 }}>Customer</Text>
                                            <Text style={{ color: '#E2E8F0', fontWeight: '500' }}>{order.customerName}</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                                <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: 3, borderRadius: 4 }}>
                                                    <MapPin size={10} color="#10B981" strokeWidth={3} />
                                                </View>
                                                <Text style={{ color: '#94A3B8', fontSize: 11 }} numberOfLines={1}>{order.customerAddress}</Text>
                                            </View>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: '#64748B', fontSize: 11, marginBottom: 2 }}>Vendor</Text>
                                            <Text style={{ color: '#E2E8F0', fontWeight: '500' }}>{order.vendorName}</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                                <View style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: 3, borderRadius: 4 }}>
                                                    <Store size={10} color="#F59E0B" strokeWidth={3} />
                                                </View>
                                                <Text style={{ color: '#94A3B8', fontSize: 11 }} numberOfLines={1}>{order.vendorAddress}</Text>
                                            </View>
                                        </View>
                                    </View>

                                    <View>
                                        <Text style={{ color: '#64748B', fontSize: 11, marginBottom: 4 }}>
                                            {historyType === 'orders' ? 'Items' : 'Returning Item'}
                                        </Text>
                                        {Array.isArray(order.parsedItems) && order.parsedItems.map((item, idx) => (
                                            <Text key={idx} style={{ color: '#CBD5E1', fontSize: 12 }}>
                                                • {item.name || item.description} x{item.quantity || item.qty || 1}
                                            </Text>
                                        ))}
                                    </View>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </View>
            </ScrollView>
        );
    }

    // --- Main View: List of Entities (Drivers or Distributors) ---
    // Sort entities by number of deliveries descending
    const entities = Object.keys(groupedHistory[activeTab]).sort((a, b) =>
        groupedHistory[activeTab][b].orders.length - groupedHistory[activeTab][a].orders.length
    );

    return (
        <ScrollView style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                <View>
                    <Text style={{ fontSize: 26, fontWeight: '800', color: '#F8FAFC', marginBottom: 6, letterSpacing: -0.5 }}>Delivery History</Text>
                    <Text style={{ color: '#94A3B8', fontSize: 13 }}>Showing {historyType} logs for {activeTab === 'fleet' ? 'drivers' : (activeTab === 'distributor' ? 'distributors' : 'vendors')}</Text>
                </View>

                {/* History Type Filter UI */}
                <View style={{ flexDirection: 'row', backgroundColor: '#1e293b', borderRadius: 10, padding: 3, borderWidth: 1, borderColor: '#334155' }}>
                    {['orders', 'returns', 'exchange'].map((type) => (
                        <TouchableOpacity
                            key={type}
                            onPress={() => { setHistoryType(type); setSelectedEntity(null); }}
                            style={{
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: 8,
                                backgroundColor: historyType === type ? '#7C3AED' : 'transparent'
                            }}
                        >
                            <Text style={{
                                color: historyType === type ? '#FFF' : '#94A3B8',
                                fontSize: 11,
                                fontWeight: '800',
                                textTransform: 'uppercase'
                            }}>
                                {type}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Tabs */}
            <View style={{ flexDirection: 'row', backgroundColor: '#1e293b', borderRadius: 12, padding: 4, marginBottom: 24 }}>
                <TouchableOpacity
                    onPress={() => { setActiveTab('fleet'); setSelectedEntity(null); setFilterStatus('delivered'); }}
                    style={{
                        flex: 1,
                        paddingVertical: 10,
                        alignItems: 'center',
                        borderRadius: 8,
                        backgroundColor: activeTab === 'fleet' ? '#7C3AED' : 'transparent',
                        flexDirection: 'row',
                        justifyContent: 'center',
                        gap: 8
                    }}
                >
                    <User size={16} color={activeTab === 'fleet' ? '#FFF' : '#94A3B8'} />
                    <Text style={{ color: activeTab === 'fleet' ? '#FFF' : '#94A3B8', fontWeight: '800', fontSize: 13 }}>Fleet</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => { setActiveTab('distributor'); setSelectedEntity(null); setFilterStatus('delivered'); }}
                    style={{
                        flex: 1,
                        paddingVertical: 10,
                        alignItems: 'center',
                        borderRadius: 8,
                        backgroundColor: activeTab === 'distributor' ? '#7C3AED' : 'transparent',
                        flexDirection: 'row',
                        justifyContent: 'center',
                        gap: 8
                    }}
                >
                    <Building2 size={16} color={activeTab === 'distributor' ? '#FFF' : '#94A3B8'} />
                    <Text style={{ color: activeTab === 'distributor' ? '#FFF' : '#94A3B8', fontWeight: '800', fontSize: 13 }}>Distributors</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => { setActiveTab('vendor'); setSelectedEntity(null); setFilterStatus('pending'); }}
                    style={{
                        flex: 1,
                        paddingVertical: 10,
                        alignItems: 'center',
                        borderRadius: 8,
                        backgroundColor: activeTab === 'vendor' ? '#7C3AED' : 'transparent',
                        flexDirection: 'row',
                        justifyContent: 'center',
                        gap: 8
                    }}
                >
                    <Store size={16} color={activeTab === 'vendor' ? '#FFF' : '#94A3B8'} />
                    <Text style={{ color: activeTab === 'vendor' ? '#FFF' : '#94A3B8', fontWeight: '800', fontSize: 13 }}>Vendors</Text>
                </TouchableOpacity>
            </View>

            {/* Entity List */}
            <View style={{ gap: 12 }}>
                {entities.length === 0 ? (
                    <View style={{ alignItems: 'center', padding: 60 }}>
                        <View style={{ backgroundColor: 'rgba(148, 163, 184, 0.1)', padding: 24, borderRadius: 40, marginBottom: 16 }}>
                            <Package size={56} color="#94A3B8" strokeWidth={1} />
                        </View>
                        <Text style={{ color: '#94A3B8', fontSize: 16, fontWeight: '600' }}>No delivery history found.</Text>
                        <Text style={{ color: '#64748B', fontSize: 13, marginTop: 4 }}>Try changing your filters or selected date</Text>
                    </View>
                ) : (
                    entities.map((name, index) => {
                        const data = groupedHistory[activeTab][name];
                        const totalOrders = data.orders.length;

                        return (
                            <TouchableOpacity
                                key={index}
                                onPress={() => setSelectedEntity(name)}
                                style={{
                                    backgroundColor: '#1e293b',
                                    borderRadius: 16,
                                    padding: 16,
                                    flexDirection: 'row',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                                    <View style={{
                                        width: 44, height: 44, borderRadius: 22,
                                        backgroundColor: activeTab === 'fleet' ? 'rgba(59, 130, 246, 0.1)' : (activeTab === 'distributor' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(139, 92, 246, 0.1)'),
                                        justifyContent: 'center', alignItems: 'center',
                                        borderWidth: 1,
                                        borderColor: activeTab === 'fleet' ? 'rgba(59, 130, 246, 0.2)' : (activeTab === 'distributor' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(139, 92, 246, 0.2)')
                                    }}>
                                        {activeTab === 'fleet' ? (
                                            <User size={20} color="#3B82F6" />
                                        ) : activeTab === 'distributor' ? (
                                            <Building2 size={20} color="#10B981" />
                                        ) : (
                                            <Store size={20} color="#8B5CF6" />
                                        )}
                                    </View>
                                    <View>
                                        <Text style={{ color: '#F8FAFC', fontWeight: '700', fontSize: 16 }}>{name}</Text>
                                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                                            <Text style={{ color: '#10B981', fontSize: 11, fontWeight: '600' }}>{data.delivered} Delivered</Text>
                                            <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '600' }}>{data.failed} Failed</Text>
                                            <Text style={{ color: '#3B82F6', fontSize: 11, fontWeight: '600' }}>{data.assigned} Assigned</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
                                            <Text style={{ color: '#22c55e', fontSize: 11, fontWeight: '600' }}>{data.paid} Paid</Text>
                                            <Text style={{ color: '#f97316', fontSize: 11, fontWeight: '600' }}>{data.pending} Pending</Text>
                                            {activeTab === 'vendor' && (
                                                <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '600' }}>{data.refunds || 0} Refund</Text>
                                            )}
                                        </View>
                                    </View>
                                </View>
                                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(148, 163, 184, 0.1)', justifyContent: 'center', alignItems: 'center' }}>
                                    <ChevronRight size={18} color="#F8FAFC" strokeWidth={3} />
                                </View>
                            </TouchableOpacity>
                        );
                    })
                )}
            </View>
        </ScrollView>
    );
}
