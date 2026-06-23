import React from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { X } from 'lucide-react-native';

export default function LiveTracking({ visible, onClose, orderId, driverName }) {
    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
                <View style={{ backgroundColor: '#1e293b', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, minHeight: '60%' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                        <View>
                            <Text style={{ color: '#F8FAFC', fontSize: 20, fontWeight: '800' }}>Live Tracking</Text>
                            <Text style={{ color: '#94A3B8', fontSize: 13 }}>Order #{orderId} • {driverName || 'Driver'}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' }}>
                            <X size={24} color="#F8FAFC" />
                        </TouchableOpacity>
                    </View>

                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 24, borderStyle: 'dashed', borderWidth: 1, borderColor: '#334155' }}>
                        <Text style={{ color: '#64748B', fontSize: 16 }}>Map Tracking Placeholder</Text>
                        <Text style={{ color: '#475569', fontSize: 12, marginTop: 8 }}>Real-time location data pending integration</Text>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
