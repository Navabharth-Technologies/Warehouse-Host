import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Modal, Platform } from 'react-native';
import { format, isSameDay, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { IndianRupee, User, Store, Calendar as CalendarIcon, Package, ArrowUpRight, TrendingUp, ChevronDown, X as CloseIcon } from 'lucide-react-native';
import { BACKEND_URL } from '../config';

export function CashCollection() {
    const [cashCollections, setCashCollections] = useState([]);
    const [selectedDate, setSelectedDate] = useState(new Date()); // Default to today
    const [activeCategory, setActiveCategory] = useState('delivery-fleet'); // 'delivery-fleet', 'distributor', 'vendor'
    const dateInputRef = useRef(null);

    const [vendorList, setVendorList] = useState([]);
    const [refundableOrderNos, setRefundableOrderNos] = useState([]);

    const fetchRefundableOrders = () => {
        fetch(`${BACKEND_URL}/api/cash/refundable-orders`)
            .then(res => res.json())
            .then(data => {
                if (data.refundableOrderNos) {
                    setRefundableOrderNos(data.refundableOrderNos);
                    console.log(`[FE-DEBUG] SET refundable list:`, data.refundableOrderNos);
                }
            })
            .catch(err => console.error("Failed to fetch refundable orders:", err));
    };

    const fetchCash = () => {
        fetch(`${BACKEND_URL}/api/cash`)
            .then(res => res.json())
            .then(data => {
                if (data.collections) {
                    setCashCollections(data.collections);
                }
            })
            .catch(err => console.error("Failed to fetch cash collections:", err));
    };

    const fetchVendors = () => {
        fetch(`${BACKEND_URL}/api/cash/vendors`)
            .then(res => res.json())
            .then(data => {
                setVendorList(data);
            })
            .catch(err => console.error("Failed to fetch vendors:", err));
    };

    useEffect(() => {
        fetchCash();
        fetchRefundableOrders();
        if (activeCategory === 'vendor') {
            fetchVendors();
        }
    }, [selectedDate, activeCategory]);

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
        }
    };

    // Filter collections based on date
    const filteredCollections = cashCollections.filter(item => {
        if (!selectedDate) return true;

        // dueDate is typically 'YYYY-MM-DD'
        if (!item.dueDate) return false;
        try {
            const itemDateStr = item.dueDate ? item.dueDate.split('T')[0] : '';
            const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
            // If it matches exactly, or if both are today (safety)
            return itemDateStr === selectedDateStr;
        } catch (e) {
            return false;
        }
    });

    const summaryCollections = filteredCollections.filter(c => c.type !== 'vendor');

    const totalPending = summaryCollections.filter(c => c.paymentStatus === 'pending').reduce((sum, c) => {
        // For distributors, use pendingAmount; for delivery boys, use amount
        const pendingAmt = c.type === 'distributor' ? (c.pendingAmount || 0) : c.amount;
        return sum + pendingAmt;
    }, 0);
    const totalReceived = summaryCollections.filter(c => c.paymentStatus === 'received' || c.paymentStatus === 'paid').reduce((sum, c) => sum + c.amount, 0);
    const pendingCount = summaryCollections.filter(c => c.paymentStatus === 'pending').length;
    const receivedCount = summaryCollections.filter(c => c.paymentStatus === 'received' || c.paymentStatus === 'paid').length;

    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [viewMode, setViewMode] = useState('transaction'); // 'transaction', 'order', or 'refund-details'
    const [activeOrder, setActiveOrder] = useState(null);
    const [selectedRefundOrder, setSelectedRefundOrder] = useState(null);
    const [refundAccountInfo, setRefundAccountInfo] = useState(null);

    const openRefundDetails = async (vendorOrderId, realOrderId, orderRetailerId, customerName) => {
        try {
            const retailerId = orderRetailerId || selectedTransaction.id;
            console.log(`[FE-DEBUG] Fetching account info for retailer: ${retailerId}, order: ${realOrderId}`);
            const res = await fetch(`${BACKEND_URL}/api/cash/retailer-account-info/${retailerId}/${realOrderId}`);
            if (res.ok) {
                const data = await res.json();
                console.log(`[FE-DEBUG] Got account info:`, data);
                setRefundAccountInfo(data);
                setSelectedRefundOrder({ vendorOrderId, realOrderId, customerName });
                setViewMode('refund-details');
            } else {
                const err = await res.json();
                console.warn(`[FE-DEBUG] Account info fetch failed:`, err);
                Alert.alert("Notice", err.message || "Failed to fetch retailer account info.");
            }
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Network error occurred.");
        }
    };

    const fetchOrderDetails = async (orderId) => {
        try {
            const res = await fetch(`${BACKEND_URL}/api/cash/order/${orderId}`);
            if (res.ok) {
                const data = await res.json();
                setActiveOrder(data);
                setViewMode('order');
            } else {
                Alert.alert("Error", "Failed to fetch order details");
            }
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Network error");
        }
    };

    // Polling effect
    useEffect(() => {
        const interval = setInterval(() => {
            if (activeCategory === 'vendor') {
                fetchVendors();
                fetchRefundableOrders();
            } else {
                fetchCash();
            }
        }, 3000);
        return () => clearInterval(interval);
    }, [activeCategory, selectedDate]);

    // Update selectedTransaction when lists change to reflect backend updates (e.g. from other users or confirmed payments)
    useEffect(() => {
        if (selectedTransaction) {
            const list = activeCategory === 'vendor' ? vendorList : cashCollections;
            const updatedItem = list.find(i => i.id === selectedTransaction.id);
            if (updatedItem) {
                // We only update the summary fields, NOT the orders, because orders are not in the list for vendors.
                // But for Total Amount Due (which depends on pendingAmount), this is crucial.
                setSelectedTransaction(prev => ({
                    ...prev,
                    pendingAmount: updatedItem.pendingAmount,
                    receivedAmount: updatedItem.receivedAmount,
                    amount: updatedItem.amount,
                    paymentStatus: updatedItem.paymentStatus
                }));
            }
        }
    }, [cashCollections, vendorList]);

    // Polling effect
    useEffect(() => {
        const interval = setInterval(() => {
            if (activeCategory === 'vendor') {
                fetchVendors();
            } else {
                fetchCash();
            }
        }, 1000); // Poll every 1 second as requested
        return () => clearInterval(interval);
    }, [activeCategory, selectedDate]);

    // Update selectedTransaction when lists change
    useEffect(() => {
        if (selectedTransaction) {
            const list = activeCategory === 'vendor' ? vendorList : cashCollections;
            const updatedItem = list.find(i => i.id === selectedTransaction.id);
            // Only update if we found it. 
            // Note: This might overwrite local optimistic updates if backend is slow.
            // But for "Total Amount Due" it ensures eventual consistency.
            // To avoid jitter, we could check if status changed or amount changed significantly?
            // For now, let's trust the backend or our optimistic update.
            // If we optimistically updated, `orders` in selectedTransaction might be newer than backend.
            // But `pendingAmount` in `updatedItem` comes from backend summary.
            // If backend hasn't updated yet, `updatedItem.pendingAmount` will be old.
            // So polling might revert the "Total Amount Due" until backend catches up.
            // However, the user wants "auto update", so this is likely what they expect.
        }
    }, [cashCollections, vendorList]);

    const handleReceive = async (receivingId) => {
        const currentList = activeCategory === 'vendor' ? vendorList : cashCollections;
        const setList = activeCategory === 'vendor' ? setVendorList : setCashCollections;

        // 1. Try to find if receivingId is a Group ID
        let transactionGroup = currentList.find(c => c.id === receivingId);
        let orderIdsToPay = [];
        let isSingleOrder = false;

        if (transactionGroup) {
            // It's a group, pay all pending orders
            orderIdsToPay = (transactionGroup.orders || []).filter(o => o.status !== 'received').map(o => o.id);
        } else {
            // 2. Try to find the group containing this Order ID
            transactionGroup = currentList.find(c => (c.orders || []).some(o => o.id === receivingId));
            if (transactionGroup) {
                isSingleOrder = true;
                orderIdsToPay = [receivingId];
            } else if (activeCategory === 'vendor' && selectedTransaction) {
                // Special case for Vendor: orders are not in the list, they are fetched on demand.
                // So we check selectedTransaction.
                if (receivingId === selectedTransaction.id) {
                    // Paying the whole vendor (only if we had orders in list, but we don't)
                    // Actually, if we are in vendor mode, `vendorList` only has summary.
                    // It does NOT have `orders` array.
                    // So `transactionGroup` (from list) works for summary, but `orders` is undefined.
                    // So we must rely on `selectedTransaction.orders`.
                    transactionGroup = selectedTransaction;
                    orderIdsToPay = (selectedTransaction.orders || []).filter(o => o.status !== 'received').map(o => o.id);
                } else {
                    // Paying single order
                    const order = (selectedTransaction.orders || []).find(o => o.id === receivingId);
                    if (order) {
                        transactionGroup = selectedTransaction; // This is the "Group" in context of the modal
                        isSingleOrder = true;
                        orderIdsToPay = [receivingId];
                    }
                }
            }
        }

        if (!transactionGroup || orderIdsToPay.length === 0) {
            Alert.alert("Error", "No pending orders found to receive.");
            return;
        }

        try {
            const response = await fetch(`${BACKEND_URL}/api/cash/receive`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderIds: orderIdsToPay })
            });

            if (response.ok) {
                // Update local list state
                setCashCollections(prev => prev.map(group => {
                    if (group.id === transactionGroup.id) {
                        // Create a new orders array with updated statuses
                        const updatedOrders = (group.orders || []).map(o =>
                            orderIdsToPay.includes(o.id) ? { ...o, status: 'received' } : o
                        );

                        // Recalculate group totals
                        const newPendingAmount = updatedOrders.filter(o => o.status !== 'received').reduce((sum, o) => sum + o.amount, 0);
                        const newReceivedAmount = updatedOrders.filter(o => o.status === 'received').reduce((sum, o) => sum + o.amount, 0);
                        const newStatus = newPendingAmount === 0 ? 'received' : 'pending';

                        return {
                            ...group,
                            paymentStatus: newStatus,
                            pendingAmount: newPendingAmount,
                            receivedAmount: newReceivedAmount,
                            orders: updatedOrders
                        };
                    }
                    return group;
                }));

                // Update selectedTransaction if it's currently open
                if (selectedTransaction && selectedTransaction.id === transactionGroup.id) {
                    setSelectedTransaction(prev => {
                        const updatedOrders = (prev.orders || []).map(o =>
                            orderIdsToPay.includes(o.id) ? { ...o, status: 'received' } : o
                        );
                        const newPendingAmount = updatedOrders.filter(o => o.status !== 'received').reduce((sum, o) => sum + o.amount, 0);
                        const newReceivedAmount = updatedOrders.filter(o => o.status === 'received').reduce((sum, o) => sum + o.amount, 0);
                        const newStatus = newPendingAmount === 0 ? 'received' : 'pending'; // Check if fully paid

                        return {
                            ...prev,
                            paymentStatus: newStatus,
                            pendingAmount: newPendingAmount,
                            receivedAmount: newReceivedAmount,
                            orders: updatedOrders
                        };
                    });
                }

                // Refresh lists to ensure sync (optional but safer)
                // if (activeCategory === 'vendor') fetchVendors(); else fetchCash();

                Alert.alert("Success", "Payment marked as received.");
            } else {
                const err = await response.json();
                Alert.alert("Error", "Failed to sync receipts: " + (err.message || "Unknown error"));
            }
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Network error occurred.");
        }
    };



    const handleRefund = async (vendorOrderId, realOrderId) => {
        const confirmMsg = `Process refund for Order #${realOrderId}? This will deduct the amount from the vendor's pending dues.`;
        const proceed = async () => {
            try {
                const response = await fetch(`${BACKEND_URL}/api/cash/vendor-refund`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ vendorOrderId, realOrderId })
                });
                const data = await response.json();
                if (response.ok) {
                    Alert.alert("Refund Processed", data.message);
                    // Remove from refundable list immediately
                    setRefundableOrderNos(prev => prev.filter(id => id !== String(realOrderId)));
                    // Update local vendor orders to mark as refunded
                    setSelectedTransaction(prev => {
                        if (!prev) return prev;
                        const updatedOrders = (prev.orders || []).map(o =>
                            o.id === vendorOrderId ? { ...o, status: 'received' } : o
                        );

                        // Recalculate totals
                        const newPendingAmount = updatedOrders.filter(o => o.status !== 'received').reduce((sum, o) => sum + o.amount, 0);
                        const newReceivedAmount = updatedOrders.filter(o => o.status === 'received').reduce((sum, o) => sum + o.amount, 0);
                        const newStatus = newPendingAmount === 0 ? 'received' : 'pending';

                        return {
                            ...prev,
                            paymentStatus: newStatus,
                            pendingAmount: newPendingAmount,
                            receivedAmount: newReceivedAmount,
                            orders: updatedOrders
                        };
                    });
                    fetchVendors();
                } else {
                    Alert.alert("Error", data.message || "Refund failed");
                }
            } catch (err) {
                console.error(err);
                Alert.alert("Error", "Network error while processing refund");
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(confirmMsg)) proceed();
        } else {
            Alert.alert("Confirm Refund", confirmMsg, [
                { text: "Cancel", style: "cancel" },
                { text: "Confirm", style: "destructive", onPress: proceed }
            ]);
        }
    };

    const handleCloseModal = () => {
        setSelectedTransaction(null);
        setViewMode('transaction');
        setActiveOrder(null);
    };

    const deliveryBoys = filteredCollections.filter(c => c.type === 'delivery-boy');
    const distributors = filteredCollections.filter(c => c.type === 'distributor');
    // const vendors = filteredCollections.filter(c => c.type === 'vendor'); // Deprecated in favor of vendorList

    const renderCard = (item) => (
        <TouchableOpacity
            key={item.id}
            activeOpacity={0.7}
            onPress={async () => {
                if (item.type === 'vendor') {
                    // Fetch details for vendor
                    try {
                        const encodedId = encodeURIComponent(item.id);
                        const res = await fetch(`${BACKEND_URL}/api/cash/vendor-orders/${encodedId}`);

                        if (!res.ok) {
                            throw new Error(`Server returned ${res.status}`);
                        }

                        const orders = await res.json();

                        if (!Array.isArray(orders)) {
                            console.error("Expected array of orders but got:", orders);
                            throw new Error("Invalid data format received");
                        }

                        setSelectedTransaction({
                            ...item,
                            orders: orders
                        });
                    } catch (e) {
                        console.error("Fetch vendor orders failed:", e);
                        Alert.alert("Error", "Failed to fetch vendor orders. Please try again.");
                    }
                } else {
                    setSelectedTransaction(item);
                }
            }}
            style={{ backgroundColor: '#0f172a', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#334155' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View>
                    <Text style={{ color: '#F8FAFC', fontWeight: '700', fontSize: 15 }}>{item.name}</Text>
                    <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 2 }}>{item.count} orders • Due: {item.dueDate.split('-').reverse().join('/')}</Text>
                </View>
                <Text style={{ color: '#10B981', fontWeight: '700', fontSize: 16 }}>₹{item.amount.toLocaleString()}</Text>
            </View>

            {(item.paymentStatus === 'received' || item.paymentStatus === 'paid') && (
                <View style={{ marginTop: 12, alignSelf: 'flex-start', backgroundColor: '#22c55e', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>✓ Received</Text>
                </View>
            )}
        </TouchableOpacity>
    );

    return (
        <View style={{ flex: 1, backgroundColor: '#020617' }}>
            <ScrollView style={{ flex: 1 }}>
                <View style={{ padding: 20 }}>
                    <View style={{ marginBottom: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(99, 102, 241, 0.1)', justifyContent: 'center', alignItems: 'center' }}>
                                <IndianRupee color="#6366f1" size={24} strokeWidth={2.5} />
                            </View>
                            <View>
                                <Text style={{ fontSize: 22, fontWeight: '800', color: '#F8FAFC' }}>Cash Collection Management</Text>
                                <Text style={{ color: '#94A3B8', fontSize: 13 }}>Track COD payments from delivery boys and distributor payments</Text>
                            </View>
                        </View>

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
                                <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(124, 58, 237, 0.15)', justifyContent: 'center', alignItems: 'center', marginLeft: -4 }}>
                                    <CalendarIcon size={16} color="#7C3AED" strokeWidth={2.5} />
                                </View>
                                <Text style={{ color: '#F8FAFC', fontWeight: '800', fontSize: 13 }}>
                                    {selectedDate ? format(selectedDate, 'MMM dd, yyyy') : 'All Dates'}
                                </Text>
                                <ChevronDown size={14} color="#94A3B8" strokeWidth={3} />
                            </TouchableOpacity>

                            {/* Web Date Input (Hidden but Functional) */}
                            {React.createElement('input', {
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
                                    pointerEvents: 'none',
                                    zIndex: -1
                                }
                            })}
                        </View>
                    </View>

                    {/* Summary Cards */}
                    <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
                        <Card style={{ flex: 1, backgroundColor: '#1e293b', padding: 16, borderColor: '#334155' }}>
                            <Text style={{ color: '#94A3B8', fontSize: 12, marginBottom: 12 }}>Total Pending</Text>
                            <Text style={{ color: '#f97316', fontSize: 24, fontWeight: '800' }}>₹{totalPending.toLocaleString()}</Text>
                            <Text style={{ color: '#94A3B8', fontSize: 10, marginTop: 4 }}>{pendingCount} pending payments</Text>
                        </Card>
                        <Card style={{ flex: 1, backgroundColor: '#1e293b', padding: 16, borderColor: '#334155' }}>
                            <Text style={{ color: '#94A3B8', fontSize: 12, marginBottom: 12 }}>Total Received</Text>
                            <Text style={{ color: '#22c55e', fontSize: 24, fontWeight: '800' }}>₹{totalReceived.toLocaleString()}</Text>
                            <Text style={{ color: '#94A3B8', fontSize: 10, marginTop: 4 }}>{receivedCount} completed payments</Text>
                        </Card>

                    </View>

                    {/* Category Buttons */}
                    <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
                        <TouchableOpacity
                            onPress={() => setActiveCategory('delivery-fleet')}
                            style={{
                                flex: 1,
                                paddingVertical: 12,
                                borderRadius: 12,
                                backgroundColor: activeCategory === 'delivery-fleet' ? '#6366f1' : '#1e293b',
                                borderWidth: 1,
                                borderColor: activeCategory === 'delivery-fleet' ? '#818cf8' : '#334155',
                                alignItems: 'center'
                            }}
                        >
                            <Text style={{ color: activeCategory === 'delivery-fleet' ? '#fff' : '#94A3B8', fontWeight: '700' }}>Delivery Fleet</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setActiveCategory('distributor')}
                            style={{
                                flex: 1,
                                paddingVertical: 12,
                                borderRadius: 12,
                                backgroundColor: activeCategory === 'distributor' ? '#6366f1' : '#1e293b',
                                borderWidth: 1,
                                borderColor: activeCategory === 'distributor' ? '#818cf8' : '#334155',
                                alignItems: 'center'
                            }}
                        >
                            <Text style={{ color: activeCategory === 'distributor' ? '#fff' : '#94A3B8', fontWeight: '700' }}>Distributor</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setActiveCategory('vendor')}
                            style={{
                                flex: 1,
                                paddingVertical: 12,
                                borderRadius: 12,
                                backgroundColor: activeCategory === 'vendor' ? '#6366f1' : '#1e293b',
                                borderWidth: 1,
                                borderColor: activeCategory === 'vendor' ? '#818cf8' : '#334155',
                                alignItems: 'center'
                            }}
                        >
                            <Text style={{ color: activeCategory === 'vendor' ? '#fff' : '#94A3B8', fontWeight: '700' }}>Vendor</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Collection Section */}
                    <View style={{ flexDirection: 'row', gap: 20, flexWrap: 'wrap' }}>
                        {/* Delivery Fleet Section */}
                        {activeCategory === 'delivery-fleet' && (
                            <View style={{ flex: 1, minWidth: 300, backgroundColor: '#1e293b', padding: 16, borderRadius: 16, borderColor: '#334155', borderWidth: 1 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                                        <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(168, 85, 247, 0.1)', justifyContent: 'center', alignItems: 'center' }}>
                                            <User size={18} color="#a855f7" strokeWidth={2.5} />
                                        </View>
                                        <Text style={{ color: '#F8FAFC', fontWeight: '800', fontSize: 14 }}>Delivery Boys COD Collection</Text>
                                    </View>
                                    <View style={{ backgroundColor: '#4b3523', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                                        <Text style={{ color: '#f97316', fontSize: 10, fontWeight: '700' }}>₹{deliveryBoys.filter(d => d.paymentStatus === 'pending').reduce((Acc, curr) => Acc + curr.amount, 0).toLocaleString()} Pending</Text>
                                    </View>
                                </View>
                                <Text style={{ color: '#94A3B8', fontSize: 12, marginBottom: 16 }}>Cash collected from Cash on Delivery orders</Text>
                                {deliveryBoys.length > 0 ? deliveryBoys.map(renderCard) : (
                                    <Text style={{ color: '#64748B', fontSize: 13, textAlign: 'center', marginTop: 20 }}>No fleet collections found for this date</Text>
                                )}
                            </View>
                        )}

                        {/* Distributor Section */}
                        {activeCategory === 'distributor' && (
                            <View style={{ flex: 1, minWidth: 300, backgroundColor: '#1e293b', padding: 16, borderRadius: 16, borderColor: '#334155', borderWidth: 1 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                                        <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(129, 140, 248, 0.1)', justifyContent: 'center', alignItems: 'center' }}>
                                            <Store size={18} color="#818cf8" strokeWidth={2.5} />
                                        </View>
                                        <Text style={{ color: '#F8FAFC', fontWeight: '800', fontSize: 14 }}>Distributor Payments</Text>
                                    </View>
                                    <View style={{ backgroundColor: '#342646', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                                        <Text style={{ color: '#a855f7', fontSize: 10, fontWeight: '700' }}>₹{distributors.filter(d => d.paymentStatus === 'pending').reduce((Acc, curr) => Acc + curr.amount, 0).toLocaleString()} Pending</Text>
                                    </View>
                                </View>
                                <Text style={{ color: '#94A3B8', fontSize: 12, marginBottom: 16 }}>Payments due from distributors to company</Text>
                                {distributors.length > 0 ? distributors.map(renderCard) : (
                                    <Text style={{ color: '#64748B', fontSize: 13, textAlign: 'center', marginTop: 20 }}>No distributor payments found for this date</Text>
                                )}
                            </View>
                        )}

                        {/* Vendor Section */}
                        {activeCategory === 'vendor' && (
                            <View style={{ flex: 1, minWidth: 300, backgroundColor: '#1e293b', padding: 16, borderRadius: 16, borderColor: '#334155', borderWidth: 1 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                                        <Package size={18} color="#10b981" />
                                        <Text style={{ color: '#F8FAFC', fontWeight: '700', fontSize: 14 }}>Vendor Collections</Text>
                                    </View>
                                    <View style={{ backgroundColor: '#064e3b', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                                        <Text style={{ color: '#10b981', fontSize: 10, fontWeight: '700' }}>₹{vendorList.filter(v => v.paymentStatus === 'pending').reduce((Acc, curr) => Acc + curr.pendingAmount, 0).toLocaleString()} Pending</Text>
                                    </View>
                                </View>
                                <Text style={{ color: '#94A3B8', fontSize: 12, marginBottom: 16 }}>Cash collections from direct vendor sales</Text>
                                {vendorList.length > 0 ? vendorList.map(renderCard) : (
                                    <Text style={{ color: '#64748B', fontSize: 13, textAlign: 'center', marginTop: 20 }}>No vendor collections found</Text>
                                )}
                            </View>
                        )}
                    </View>
                </View>
            </ScrollView>

            {/* Details Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={!!selectedTransaction}
                onRequestClose={handleCloseModal}
            >
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
                    <View style={{ backgroundColor: '#1e293b', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingVertical: 24, maxHeight: '90%' }}>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Transaction View */}
                            {selectedTransaction && viewMode === 'transaction' && (
                                <View>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                                        <View>
                                            <Text style={{ color: '#F8FAFC', fontSize: 24, fontWeight: '800' }}>{selectedTransaction.name}</Text>
                                            <Text style={{ color: '#94A3B8', fontSize: 14, textTransform: 'capitalize' }}>{selectedTransaction.type.replace('-', ' ')}</Text>
                                        </View>
                                        <TouchableOpacity onPress={handleCloseModal} style={{ padding: 4 }}>
                                            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center' }}>
                                                <Text style={{ color: '#fff', fontWeight: 'bold' }}>✕</Text>
                                            </View>
                                        </TouchableOpacity>
                                    </View>


                                    <View style={{ backgroundColor: '#0f172a', borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#334155' }}>
                                        <Text style={{ color: '#94A3B8', fontSize: 12, marginBottom: 4 }}>Total Amount Due</Text>
                                        <Text style={{ color: '#10B981', fontSize: 32, fontWeight: '900' }}>₹{(selectedTransaction.pendingAmount !== undefined ? selectedTransaction.pendingAmount : selectedTransaction.amount).toLocaleString()}</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
                                            <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: (selectedTransaction.paymentStatus === 'received' || selectedTransaction.paymentStatus === 'paid') ? '#22c55e' : '#f97316' }}>
                                                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700', textTransform: 'capitalize' }}>{selectedTransaction.paymentStatus}</Text>
                                            </View>
                                            <Text style={{ color: '#64748B', fontSize: 12 }}>Due Date: {selectedTransaction.dueDate}</Text>
                                        </View>
                                    </View>

                                    {/* Show pending orders if any exist, otherwise show received orders */}
                                    {(() => {
                                        const orders = Array.isArray(selectedTransaction.orders) ? selectedTransaction.orders : [];
                                        const pendingOrders = orders.filter(o => o.status !== 'received' || o.isRefundable);
                                        const receivedOrders = orders.filter(o => o.status === 'received' && !o.isRefundable);
                                        const ordersToShow = pendingOrders.length > 0 ? pendingOrders : receivedOrders;

                                        return (
                                            <>
                                                <Text style={{ color: '#F8FAFC', fontSize: 16, fontWeight: '700', marginBottom: 12 }}>
                                                    Associated Orders ({ordersToShow.length})
                                                </Text>
                                                <View style={{ gap: 8 }}>
                                                    {ordersToShow.map((ord, idx) => (
                                                        <View
                                                            key={idx}
                                                            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#334155' }}>
                                                            {(() => {
                                                                if (selectedTransaction.type === 'vendor') {
                                                                    const tid = String(ord.realOrderId || '').trim().toLowerCase();
                                                                    const isMatch = refundableOrderNos.some(rid => String(rid || '').trim().toLowerCase() === tid);
                                                                    console.log(`[FE-DEBUG] Order: ${ord.id} | Real: "${tid}" | RefundableList: ${JSON.stringify(refundableOrderNos)} | Match: ${isMatch}`);
                                                                    return null;
                                                                }
                                                                return null;
                                                            })()}
                                                            <TouchableOpacity
                                                                onPress={() => {
                                                                    fetchOrderDetails(ord.id.startsWith('DIST-') && ord.realOrderId ? ord.realOrderId : ord.id);
                                                                }}
                                                                style={{ flex: 1 }}>
                                                                <View>
                                                                    <Text style={{ color: '#94A3B8', fontSize: 14, fontWeight: '600' }}>
                                                                        {ord.id.startsWith('DIST-') && (ord.orderNo || ord.realOrderId) 
                                                                            ? `${ord.orderNo || ord.realOrderId} (${ord.id})` 
                                                                            : (ord.orderNo || ord.realOrderId || ord.id)}
                                                                    </Text>
                                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                                        {ord.paidStatus === 'Refunded' ? (
                                                                            <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '900' }}>REFUNDED: ₹{ord.amount.toLocaleString()}</Text>
                                                                        ) : (
                                                                            <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '700' }}>₹{ord.amount.toLocaleString()}</Text>
                                                                        )}
                                                                        {ord.status && (
                                                                            <View style={{ backgroundColor: ord.status === 'received' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(249, 115, 22, 0.1)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                                                                                <Text style={{ color: ord.status === 'received' ? '#22c55e' : '#f97316', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>{ord.status}</Text>
                                                                            </View>
                                                                        )}
                                                                    </View>
                                                                </View>
                                                            </TouchableOpacity>

                                                            {/* Paid Button for Vendor Orders (kept per user request) */}
                                                            {selectedTransaction.type === 'vendor' && ord.status !== 'received' && (
                                                                <TouchableOpacity
                                                                    onPress={() => handleReceive(ord.id)} // Pass single order ID to handleReceive
                                                                    style={{ backgroundColor: '#10B981', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginLeft: 8 }}
                                                                >
                                                                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Paid</Text>
                                                                </TouchableOpacity>
                                                            )}

                                                            {/* Refund Button for Vendor Orders (replacing View) */}
                                                            {selectedTransaction.type === 'vendor' && (ord.status !== 'received' || ord.isRefundable) && (() => {
                                                                const isRefundable = !!ord.isRefundable;
                                                                return (
                                                                    <TouchableOpacity
                                                                        onPress={() => isRefundable && openRefundDetails(ord.id, ord.orderNo || ord.realOrderId, ord.retailerId, ord.customerName)}
                                                                        disabled={!isRefundable}
                                                                        style={{
                                                                            backgroundColor: isRefundable ? '#EF4444' : '#1e293b',
                                                                            paddingHorizontal: 12,
                                                                            paddingVertical: 6,
                                                                            borderRadius: 8,
                                                                            marginLeft: 8,
                                                                            borderWidth: 1,
                                                                            borderColor: isRefundable ? '#EF4444' : '#334155',
                                                                            opacity: isRefundable ? 1 : 0.5
                                                                        }}
                                                                    >
                                                                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Refund</Text>
                                                                    </TouchableOpacity>
                                                                );
                                                            })()}

                                                        </View>
                                                    ))}
                                                </View>
                                            </>
                                        );
                                    })()}

                                    {selectedTransaction.paymentStatus === 'pending' && activeCategory !== 'vendor' && (
                                        <TouchableOpacity
                                            onPress={() => handleReceive(selectedTransaction.id)}
                                            style={{ backgroundColor: '#10B981', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 24 }}
                                        >
                                            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Mark as Received</Text>
                                        </TouchableOpacity>
                                    )}

                                    {selectedTransaction.paymentStatus !== 'pending' && (
                                        <View style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 24, borderWidth: 1, borderColor: '#22c55e' }}>
                                            <Text style={{ color: '#22c55e', fontWeight: '800', fontSize: 16 }}>✓ Payment Received</Text>
                                        </View>
                                    )}
                                </View>
                            )}
                            {/* Refund Details View */}
                            {viewMode === 'refund-details' && refundAccountInfo && (
                                <View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 }}>
                                        <TouchableOpacity onPress={() => setViewMode('transaction')} style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: 'rgba(239, 68, 68, 0.15)', justifyContent: 'center', alignItems: 'center' }}>
                                            <CloseIcon size={18} color="#EF4444" strokeWidth={2.5} />
                                        </TouchableOpacity>
                                        <Text style={{ color: '#F8FAFC', fontSize: 18, fontWeight: '800' }}>Pay to Retailer</Text>
                                    </View>

                                    <View style={{ gap: 16 }}>
                                        {(() => {
                                            const hasAccountInfo = refundAccountInfo.BankAccountNumber || refundAccountInfo.BankAccountNo;

                                            if (hasAccountInfo) {
                                                return (
                                                    <View style={{ backgroundColor: '#0f172a', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#334155', gap: 16 }}>
                                                        <View>
                                                            <Text style={{ color: '#94A3B8', fontSize: 12, marginBottom: 4 }}>RETAILER NAME</Text>
                                                            <Text style={{ color: '#F8FAFC', fontSize: 16, fontWeight: '700' }}>{refundAccountInfo.BankRetailerName || refundAccountInfo.RetailerName || selectedRefundOrder?.customerName || 'N/A'}</Text>
                                                        </View>
                                                        <View>
                                                            <Text style={{ color: '#94A3B8', fontSize: 12, marginBottom: 4 }}>BANK ACCOUNT NUMBER</Text>
                                                            <Text style={{ color: '#F8FAFC', fontSize: 18, fontWeight: '800', letterSpacing: 1 }}>{hasAccountInfo}</Text>
                                                        </View>
                                                        <View style={{ flexDirection: 'row', gap: 20 }}>
                                                            <View style={{ flex: 1 }}>
                                                                <Text style={{ color: '#94A3B8', fontSize: 12, marginBottom: 4 }}>IFSC CODE</Text>
                                                                <Text style={{ color: '#F8FAFC', fontSize: 16, fontWeight: '700' }}>{refundAccountInfo.BankIFSCCode || 'N/A'}</Text>
                                                            </View>
                                                            <View style={{ flex: 1 }}>
                                                                <Text style={{ color: '#94A3B8', fontSize: 12, marginBottom: 4 }}>BANK NAME</Text>
                                                                <Text style={{ color: '#F8FAFC', fontSize: 16, fontWeight: '700' }}>{refundAccountInfo.BankName || 'N/A'}</Text>
                                                            </View>
                                                        </View>
                                                    </View>
                                                );
                                            } else if (refundAccountInfo.RefundUPIID || refundAccountInfo.UPIID) {
                                                return (
                                                    <View style={{ backgroundColor: '#0f172a', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#334155', gap: 16 }}>
                                                        <View>
                                                            <Text style={{ color: '#94A3B8', fontSize: 12, marginBottom: 4 }}>RETAILER NAME</Text>
                                                            <Text style={{ color: '#F8FAFC', fontSize: 16, fontWeight: '700' }}>{refundAccountInfo.BankRetailerName || refundAccountInfo.RetailerName || selectedRefundOrder?.customerName || 'N/A'}</Text>
                                                        </View>
                                                        <View>
                                                            <Text style={{ color: '#94A3B8', fontSize: 12, marginBottom: 4 }}>UPI ID</Text>
                                                            <Text style={{ color: '#F8FAFC', fontSize: 20, fontWeight: '800' }}>{refundAccountInfo.RefundUPIID || refundAccountInfo.UPIID}</Text>
                                                        </View>
                                                    </View>
                                                );
                                            } else {
                                                return (
                                                    <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                                                        <Text style={{ color: '#EF4444', fontSize: 14, fontWeight: '600', textAlign: 'center' }}>No payment information available for this retailer.</Text>
                                                    </View>
                                                );
                                            }
                                        })()}

                                        <TouchableOpacity
                                            onPress={() => {
                                                handleRefund(selectedRefundOrder.vendorOrderId, selectedRefundOrder.realOrderId);
                                                setViewMode('transaction');
                                            }}
                                            style={{ backgroundColor: '#EF4444', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 12, shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}
                                        >
                                            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Submit Refund</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}

                            {/* Order Detail View */}
                            {activeOrder && viewMode === 'order' && (
                                <View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 }}>
                                        <TouchableOpacity onPress={() => setViewMode('transaction')} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center' }}>
                                            <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>←</Text>
                                        </TouchableOpacity>
                                        <View>
                                            <Text style={{ color: '#F8FAFC', fontSize: 20, fontWeight: '800' }}>Order Details</Text>
                                            <Text style={{ color: '#94A3B8', fontSize: 12 }}>{activeOrder.id}</Text>
                                        </View>
                                    </View>

                                    <View style={{ backgroundColor: '#0f172a', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#334155', marginBottom: 16 }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                            <Text style={{ color: '#64748B', fontSize: 12 }}>Customer</Text>
                                            <Text style={{ color: '#F8FAFC', fontWeight: '600', fontSize: 13 }}>{activeOrder.customer}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                            <Text style={{ color: '#64748B', fontSize: 12 }}>Payment Method</Text>
                                            <Text style={{ color: '#F8FAFC', fontWeight: '600', fontSize: 13 }}>{activeOrder.paymentMethod}</Text>
                                        </View>
                                        <View style={{ justifyContent: 'space-between' }}>
                                            <Text style={{ color: '#64748B', fontSize: 12, marginBottom: 4 }}>Address</Text>
                                            <Text style={{ color: '#F8FAFC', fontWeight: '600', fontSize: 13, lineHeight: 18 }}>{activeOrder.address}</Text>
                                        </View>
                                    </View>

                                    <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '700', marginBottom: 12 }}>Items Summary</Text>
                                    <View style={{ backgroundColor: '#0f172a', borderRadius: 12, borderWidth: 1, borderColor: '#334155', overflow: 'hidden' }}>
                                        {activeOrder.items.map((item, idx) => (
                                            <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderBottomWidth: idx === activeOrder.items.length - 1 ? 0 : 1, borderBottomColor: '#1e293b' }}>
                                                <View>
                                                    <Text style={{ color: '#F8FAFC', fontSize: 13, fontWeight: '600' }}>{item.name}</Text>
                                                    <Text style={{ color: '#64748B', fontSize: 11 }}>Qty: {item.qty}</Text>
                                                </View>
                                                <Text style={{ color: '#F8FAFC', fontWeight: '700' }}>₹{item.price}</Text>
                                            </View>
                                        ))}
                                        <View style={{ backgroundColor: 'rgba(124, 58, 237, 0.1)', padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text style={{ color: '#7C3AED', fontWeight: '700' }}>Total Amount</Text>
                                            <Text style={{ color: '#7C3AED', fontWeight: '900', fontSize: 16 }}>₹{activeOrder.total.toLocaleString()}</Text>
                                        </View>
                                    </View>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
