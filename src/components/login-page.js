import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Alert, Image } from 'react-native';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { LogIn, SkipForward } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BACKEND_URL } from '../config';
import LogoSource from '../../assets/logo.png';

export function LoginPage({ onLogin }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});

    const handleEmailChange = (text) => {
        setEmail(text);
        if (text && !/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,3}$/.test(text)) {
            setFieldErrors(prev => ({ ...prev, email: 'Invalid email format' }));
        } else {
            setFieldErrors(prev => ({ ...prev, email: '' }));
        }
    };

    const handleSubmit = async () => {
        setError('');
        if (!email || !password) {
            setError('Please enter both email and password');
            return;
        }

        try {
            const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                // Login Success
                onLogin(data.user);
            } else {
                // Login Failed
                if (response.status === 400 || response.status === 404) {
                    const msg = data.message || 'User not found. Please Register.';
                    setError(msg);
                    if (Platform.OS === 'web') {
                        // Optional: don't alert if we are showing it inline, but user has alert code existing
                        // window.alert(msg); 
                    } else {
                        Alert.alert("Login Failed", msg);
                    }
                } else {
                    setError(data.message || 'Login failed');
                }
            }
        } catch (err) {
            console.error(err);
            setError('Network error. Please ensure the backend server is running on Port 5001, and that your current IP address is whitelisted in Azure SQL Database firewall.');
        }
    };

    const handleSkip = () => {
        // Prepare demo login if needed, or keep as is but warn it might fail real auth if backend enforced
        onLogin('admin@jkdmart.com');
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, backgroundColor: '#0f172a' }}
        >
            <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
                <View style={{ flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#0f172a' }}>
                    <Card style={{ width: '100%', maxWidth: 400, alignSelf: 'center', backgroundColor: '#1e293b', borderWidth: 0, borderRadius: 24, padding: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 }}>
                        <CardHeader style={{ alignItems: 'center', paddingVertical: 40 }}>
                            <View style={{ marginBottom: 24 }}>
                                <LinearGradient
                                    colors={['#774FC3', '#B94283']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={{ width: 140, height: 140, borderRadius: 70, justifyContent: 'center', alignItems: 'center', shadowColor: '#774FC3', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 }}
                                >
                                    <Image
                                        source={LogoSource}
                                        style={{ width: '100%', height: '100%' }}
                                        resizeMode="contain"
                                    />
                                </LinearGradient>
                            </View>
                            <View style={{ alignItems: 'center' }}>
                                <CardTitle style={{ textAlign: 'center', fontSize: 28, fontWeight: '800', color: '#F8FAFC', letterSpacing: -0.5 }}>JKD MART Logistics</CardTitle>
                                <CardDescription style={{ textAlign: 'center', color: '#94A3B8', fontSize: 16, marginTop: 8, lineHeight: 22 }}>
                                    Sign in to access the premium logistics management system
                                </CardDescription>
                            </View>
                        </CardHeader>
                        <CardContent>
                            <View style={{ width: '100%', gap: 20 }}>
                                <Input
                                    label="Email Address"
                                    placeholder="admin@jkdmart.com"
                                    value={email}
                                    onChangeText={handleEmailChange}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                    error={fieldErrors.email}
                                    inputStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', height: 56, borderRadius: 16, color: '#F8FAFC' }}
                                    labelStyle={{ color: '#94A3B8', fontSize: 14, fontWeight: '600', marginBottom: 8 }}
                                />
                                <Input
                                    label="Password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry
                                    inputStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', height: 56, borderRadius: 16, color: '#F8FAFC' }}
                                    labelStyle={{ color: '#94A3B8', fontSize: 14, fontWeight: '600', marginBottom: 8 }}
                                />

                                {error ? (
                                    <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)', marginBottom: 8 }}>
                                        <Text style={{ color: '#F87171', fontSize: 14, fontWeight: '500' }}>{error}</Text>
                                    </View>
                                ) : null}

                                <TouchableOpacity
                                    onPress={handleSubmit}
                                    style={{ shadowColor: '#774FC3', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4, marginTop: 12 }}
                                >
                                    <LinearGradient
                                        colors={['#774FC3', '#B94283']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={{ height: 56, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}
                                    >
                                        <LogIn size={20} color="#FFFFFF" style={{ marginRight: 12 }} />
                                        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 17 }}>Sign In</Text>
                                    </LinearGradient>
                                </TouchableOpacity>

                                <View style={{ backgroundColor: 'rgba(59, 130, 246, 0.05)', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.1)', marginTop: 8 }}>
                                    <Text style={{ color: '#60A5FA', fontSize: 14, fontWeight: '700', marginBottom: 6 }}>Demo Credentials:</Text>
                                    <Text style={{ color: '#94A3B8', fontSize: 13, marginBottom: 2 }}>Email: <Text style={{ color: '#BFDBFE' }}>admin@jkdmart.com</Text></Text>
                                    <Text style={{ color: '#94A3B8', fontSize: 13 }}>Password: <Text style={{ color: '#BFDBFE' }}>admin123</Text></Text>
                                </View>
                            </View>
                        </CardContent>
                    </Card>

                    <View style={{ marginTop: 40, alignItems: 'center' }}>
                        <Text style={{ color: '#475569', fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
                            © 2024 JKD MART Logistics Hub Management.{"\n"}
                            Powered by JKD MART
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView >
    );
}
