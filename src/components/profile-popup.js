import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, Animated, Dimensions, Platform, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { LogOut, User, Mail, Phone, X, Shield, History } from 'lucide-react-native';

export function ProfilePopup({ user, visible, onClose, onLogout, onHistory }) {
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
    }, [visible]);

    if (!visible) return null;

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center' }}>
                <TouchableOpacity style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={onClose} />

                <Animated.View style={{ opacity: fadeAnim, width: '90%', maxWidth: 400, backgroundColor: '#1e293b', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <Text style={{ fontSize: 20, fontWeight: '700', color: '#F8FAFC' }}>My Profile</Text>
                        <TouchableOpacity onPress={onClose} style={{ width: 34, height: 34, backgroundColor: 'rgba(239, 68, 68, 0.15)', borderRadius: 12, justifyContent: 'center', alignItems: 'center' }}>
                            <X size={18} color="#EF4444" strokeWidth={2.5} />
                        </TouchableOpacity>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#334155' }}>
                            <User size={30} color="#94A3B8" />
                        </View>
                        <View>
                            <Text style={{ fontSize: 18, fontWeight: '700', color: '#F8FAFC' }}>{user.name || 'Admin User'}</Text>
                            <Text style={{ color: '#64748B', fontSize: 14 }}>Hub Manager</Text>
                        </View>
                    </View>

                    <View style={{ backgroundColor: '#0f172a', borderRadius: 16, padding: 16, gap: 16, marginBottom: 24 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(139, 92, 246, 0.1)', justifyContent: 'center', alignItems: 'center' }}>
                                <Mail size={18} color="#8B5CF6" />
                            </View>
                            <View>
                                <Text style={{ color: '#64748B', fontSize: 11, marginBottom: 1 }}>Email</Text>
                                <Text style={{ color: '#E2E8F0', fontSize: 14, fontWeight: '600' }}>{user.email || 'admin@jkdmart.com'}</Text>
                            </View>
                        </View>

                        <View style={{ height: 1, backgroundColor: '#334155' }} />

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(16, 185, 129, 0.1)', justifyContent: 'center', alignItems: 'center' }}>
                                <Phone size={18} color="#10B981" />
                            </View>
                            <View>
                                <Text style={{ color: '#64748B', fontSize: 11, marginBottom: 1 }}>Phone</Text>
                                <Text style={{ color: '#E2E8F0', fontSize: 14, fontWeight: '600' }}>{user.phone || '+91 98765 43210'}</Text>
                            </View>
                        </View>
                    </View>

                    <TouchableOpacity onPress={onHistory} activeOpacity={0.8} style={{ marginBottom: 12 }}>
                        <View style={{ backgroundColor: '#10B981', borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                            <History size={18} color="#FFF" />
                            <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '700' }}>History</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={onLogout} activeOpacity={0.8}>
                        <LinearGradient
                            colors={['#EF4444', '#F43F5E']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{ borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}
                        >
                            <LogOut size={18} color="#FFF" />
                            <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '700' }}>Log Out</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    <View style={{ marginTop: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
                        <Shield size={12} color="#475569" />
                        <Text style={{ color: '#475569', fontSize: 11 }}>v1.0.24</Text>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}
