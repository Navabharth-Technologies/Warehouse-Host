import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from './ui/card';
import { Package, Truck, CheckCircle, Clock } from 'lucide-react-native';
import { BACKEND_URL } from '../config';

export function ShipmentDashboard({ shipments = [], activities = [], downloadedSlots = {} }) {
    // Local state to track real-time delivery statuses (delivered/failed) which aren't in the main orders table
    const [transitStatuses, setTransitStatuses] = useState({});

    useEffect(() => {
        const fetchTransitStatus = async () => {
            try {
                const response = await fetch(`${BACKEND_URL}/api/transit/transit-status`);
                if (response.ok) {
                    const data = await response.json();
                    const statusMap = {};
                    data.forEach(item => {
                        statusMap[item.id] = item.transitStatus || item.status;
                    });
                    setTransitStatuses(statusMap);
                }
            } catch (error) {
                console.error("Error fetching dashboard transit status:", error);
            }
        };

        fetchTransitStatus();
        const interval = setInterval(fetchTransitStatus, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, []);

    // Logic matching ShipmentCollection
    const pendingCollectionOrders = shipments.filter(s => {
        if (!s.status) return false;
        const st = s.status.trim().toLowerCase();
        return st === 'pending' || st === 'in-transit' || st === 'in transit' || st === 'intransit';
    });

    const pendingCount = pendingCollectionOrders.length;

    // Flatten downloaded IDs
    const allDownloadedIds = Object.values(downloadedSlots).flat();
    const notDownloadedCount = pendingCollectionOrders.filter(s => !allDownloadedIds.includes(s.id)).length;

    // Filter "Ready for Delivery" to ONLY show active In-Transit orders
    const activeTransitCount = shipments.filter(s => {
        if (s.status !== 'ready-for-delivery') return false;

        // Check enrichment
        const finalStatus = (transitStatuses[s.id] || '').toLowerCase();
        // Exclude if delivered, failed, or cancelled
        if (['delivered', 'failed', 'cancelled'].includes(finalStatus)) return false;

        return true;
    }).length;

    // Effect to force re-render every 30s to update "x mins ago"
    const [, setTick] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => setTick(t => t + 1), 30000);
        return () => clearInterval(timer);
    }, []);

    const getRelativeTime = (timestamp) => {
        if (!timestamp) return 'Just now';
        const diff = Math.floor((Date.now() - timestamp) / 1000);
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    };

    const stats = {
        pending: pendingCount,
        collected: shipments.filter(s => s.status === 'collected' || s.status === 'at-hub').length,
        packaged: shipments.filter(s => s.status === 'packaged').length,
        ready: activeTransitCount, // Use enriched count
    };

    return (
        <ScrollView style={{ flex: 1 }}>
            <View style={{ marginBottom: 24 }}>
                <Text style={{ fontSize: 26, fontWeight: '800', color: '#F8FAFC', marginBottom: 6, letterSpacing: -0.5 }}>Dashboard Overview</Text>
                <Text style={{ color: '#94A3B8', fontSize: 15 }}>Track real-time shipment logistics and metrics</Text>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }}>
                {[
                    {
                        label: 'Pending Collection',
                        value: stats.pending,
                        sub: `${notDownloadedCount} PDF${notDownloadedCount !== 1 ? 's' : ''} not downloaded`,
                        color: '#D97706',
                        bg: 'rgba(217, 119, 6, 0.1)',
                        Icon: Clock
                    },
                    { label: 'At Hub', value: stats.collected, sub: 'Ready for labeling', color: '#2563EB', bg: 'rgba(37, 99, 235, 0.1)', Icon: Package },
                    { label: 'Packaged', value: stats.packaged, sub: 'Labeled packages', color: '#7C3AED', bg: 'rgba(124, 58, 237, 0.1)', Icon: CheckCircle },
                    { label: 'In Transit', value: stats.ready, sub: 'Assigned to drivers', color: '#16A34A', bg: 'rgba(22, 163, 74, 0.1)', Icon: Truck },
                ].map((item, index) => (
                    <Card key={index} style={{ width: '48%', marginBottom: 8, backgroundColor: '#1e293b', borderWidth: 0, borderRadius: 20 }}>
                        <CardHeader style={{ paddingBottom: 8 }}>
                            <CardDescription style={{ fontSize: 13, fontWeight: '600', color: '#94A3B8' }}>{item.label}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <View>
                                    <Text style={{ fontSize: 28, fontWeight: '800', color: '#F8FAFC' }}>{item.value}</Text>
                                    <Text style={{ fontSize: 10, color: '#64748B', marginTop: 4, fontWeight: '500' }}>{item.sub}</Text>
                                </View>
                                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: item.bg, justifyContent: 'center', alignItems: 'center' }}>
                                    <item.Icon size={24} color={item.color} />
                                </View>
                            </View>
                        </CardContent>
                    </Card>
                ))}
            </View>

            <View style={{ marginTop: 24 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#F8FAFC', marginBottom: 16 }}>Recent Operations</Text>
                <Card style={{ backgroundColor: '#1e293b', borderWidth: 0, borderRadius: 20, padding: 4 }}>
                    <CardContent>
                        {activities.length === 0 ? (
                            <Text style={{ color: '#94A3B8', textAlign: 'center', padding: 20 }}>No logs available</Text>
                        ) : (
                            activities.map((act, i) => {
                                const Icon = act.icon || Package;
                                return (
                                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: i === activities.length - 1 ? 0 : 1, borderBottomColor: '#334155' }}>
                                        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${act.color}20`, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                                            <Icon size={18} color={act.color} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: '#F8FAFC', fontWeight: '600', fontSize: 14 }}>{act.message}</Text>
                                            <Text style={{ color: '#94A3B8', fontSize: 12 }}>{getRelativeTime(act.timestamp)}</Text>
                                        </View>
                                        <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
                                            <Text style={{ color: act.color, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' }}>{act.type}</Text>
                                        </View>
                                    </View>
                                );
                            })
                        )}
                    </CardContent>
                </Card>
            </View>
        </ScrollView >
    );
}
