import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Phone, Truck, Bike, Plus, Edit, Trash2, Mail, ShieldCheck, X, ChevronDown, Upload, Store } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { BACKEND_URL } from '../config';

export function DeliveryBoyManagement({ deliveryBoys = [], onUpdateDeliveryBoys, distributors = [], onUpdateDistributors }) {
    const [viewMode, setViewMode] = useState('drivers'); // 'drivers' or 'distributors'
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isSelectionModalVisible, setIsSelectionModalVisible] = useState(false);
    const [isDistributorModalVisible, setIsDistributorModalVisible] = useState(false);
    const [distributorFormData, setDistributorFormData] = useState({
        name: '',
        email: '',
        phone: '',
        address: '',
        pincode: '',
        aadharNumber: '',
        panNumber: '',
        photo: null,
        password: '',
        confirmPassword: ''
    });

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        address: '',
        vehicleNumber: '',
        vehicleType: 'Bike',
        aadhar: '',
        pan: '',
        photo: null,
        password: '',
        confirmPassword: ''
    });

    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedDriverId, setSelectedDriverId] = useState(null);
    const [isDistributorEditMode, setIsDistributorEditMode] = useState(false);
    const [selectedDistributorId, setSelectedDistributorId] = useState(null);

    const [errors, setErrors] = useState({});
    const [distributorErrors, setDistributorErrors] = useState({});
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 1,
        });

        if (!result.canceled) {
            setFormData({ ...formData, photo: result.assets[0].uri });
        }
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => {
            const newData = { ...prev, [field]: value };
            let error = "";

            switch (field) {
                case 'name':
                    if (!value.trim()) error = "Name is required";
                    else if (!/^[a-zA-Z\s.]+$/.test(value)) error = "Name should only contain letters";
                    break;
                case 'email':
                    if (!value.trim()) error = "Email is required";
                    else if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,3}$/.test(value)) error = "Invalid email format";
                    break;
                case 'phone':
                    const cleanPhone = value.replace(/\D/g, '');
                    if (!value.trim()) error = "Phone number is required";
                    else if (!/^[6789]\d{9}$/.test(cleanPhone)) error = "Must be 10 digits starting with 6,7,8 or 9";
                    else if (/^(.)\1{8,9}$/.test(cleanPhone)) error = "Invalid number: Repeating digits";
                    break;
                case 'address':
                    if (!value.trim()) error = "Address is required";
                    break;
                case 'vehicleNumber':
                    if (!value.trim()) error = "Vehicle number is required";
                    else if (!/^[A-Z]{2}[- ]?\d{2}[- ]?[A-Z]{1,2}[- ]?\d{4}$/i.test(value.trim())) error = "Invalid format (e.g. KA-19-HY-4657)";
                    break;
                case 'aadhar':
                    const cleanAadhar = value.replace(/\s/g, '');
                    if (!value.trim()) error = "Aadhar number is required";
                    else if (!/^\d{12}$/.test(cleanAadhar)) error = "Aadhar must be 12 digits";
                    else if (/(.)\1{7,}/.test(cleanAadhar)) error = "Invalid Aadhar: Repeating digits";
                    break;
                case 'pan':
                    if (!value.trim()) error = "PAN is required";
                    else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(value.toUpperCase())) error = "Invalid PAN format (e.g., ABCDE1234F)";
                    break;
                case 'password':
                    if (!value && !isEditMode) error = "Password is required";
                    else if (value && value.length < 8) error = "Min 8 characters required";
                    if (newData.confirmPassword && value !== newData.confirmPassword) {
                        setErrors(prev => ({ ...prev, confirmPassword: "Passwords do not match" }));
                    } else if (newData.confirmPassword) {
                        setErrors(prev => ({ ...prev, confirmPassword: "" }));
                    }
                    break;
                case 'confirmPassword':
                    if (value !== newData.password) error = "Passwords do not match";
                    break;
            }

            setErrors(prev => ({ ...prev, [field]: error }));
            return newData;
        });
    };

    const handleDistributorInputChange = (field, value) => {
        setDistributorFormData(prev => {
            const newData = { ...prev, [field]: value };
            let error = "";

            switch (field) {
                case 'name':
                    if (!value.trim()) error = "Name is required";
                    break;
                case 'email':
                    if (!value.trim()) error = "Email is required";
                    else if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,3}$/.test(value)) error = "Invalid email format";
                    break;
                case 'phone':
                    const cleanPhone = value.replace(/\D/g, '');
                    if (!value.trim()) error = "Phone number is required";
                    else if (!/^[6789]\d{9}$/.test(cleanPhone)) error = "Must be 10 digits starting with 6,7,8 or 9";
                    else if (/^(.)\1{8,9}$/.test(cleanPhone)) error = "Invalid number: Repeating digits";
                    break;
                case 'address':
                    if (!value.trim()) error = "Address is required";
                    break;
                case 'pincode':
                    if (!value.trim()) error = "Pincode is required";
                    else if (!/^\d{6}$/.test(value)) error = "Pincode must be 6 digits";
                    break;
                case 'aadharNumber':
                    const cleanAadharNum = value.replace(/\s/g, '');
                    if (!value.trim()) error = "Aadhar is required";
                    else if (!/^\d{12}$/.test(cleanAadharNum)) error = "Aadhar must be 12 digits";
                    else if (/(.)\1{7,}/.test(cleanAadharNum)) error = "Invalid Aadhar: Repeating digits";
                    break;
                case 'panNumber':
                    if (!value.trim()) error = "PAN is required";
                    else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(value.toUpperCase())) error = "Invalid PAN format";
                    break;
                case 'password':
                    if (!value && !isDistributorEditMode) error = "Password is required";
                    else if (value && value.length < 8) error = "Min 8 characters required";
                    if (newData.confirmPassword && value !== newData.confirmPassword) {
                        setDistributorErrors(prev => ({ ...prev, confirmPassword: "Passwords do not match" }));
                    } else if (newData.confirmPassword) {
                        setDistributorErrors(prev => ({ ...prev, confirmPassword: "" }));
                    }
                    break;
                case 'confirmPassword':
                    if (value !== newData.password) error = "Passwords do not match";
                    break;
            }

            setDistributorErrors(prev => ({ ...prev, [field]: error }));
            return newData;
        });
    };

    const validate = () => {
        let newErrors = {};
        if (!formData.name.trim()) newErrors.name = "Name is required";
        if (!formData.email.trim()) {
            newErrors.email = "Email is required";
        } else if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,3}$/.test(formData.email)) {
            newErrors.email = "Invalid email format";
        }

        if (!formData.phone.trim()) {
            newErrors.phone = "Phone number is required";
        } else {
            const cleanPhone = formData.phone.replace(/\D/g, '');
            if (!/^[6789]\d{9}$/.test(cleanPhone)) {
                newErrors.phone = "Must be 10 digits starting with 6,7,8 or 9";
            } else if (/^(.)\1{8,9}$/.test(cleanPhone)) {
                newErrors.phone = "Invalid number: Repeating digits";
            }
        }

        if (!formData.address.trim()) newErrors.address = "Address is required";
        if (!formData.vehicleNumber.trim()) {
            newErrors.vehicleNumber = "Vehicle number is required";
        } else if (!/^[A-Z]{2}[- ]?\d{2}[- ]?[A-Z]{1,2}[- ]?\d{4}$/i.test(formData.vehicleNumber.trim())) {
            newErrors.vehicleNumber = "Invalid format (e.g. KA-19-HY-4657)";
        }

        if (!formData.aadhar || !formData.aadhar.trim()) {
            newErrors.aadhar = "Aadhar number is required";
        } else {
            const cleanAadhar = formData.aadhar.replace(/\s/g, '');
            if (!/^\d{12}$/.test(cleanAadhar)) {
                newErrors.aadhar = "Aadhar number must be 12 digits";
            } else if (/(.)\1{7,}/.test(cleanAadhar)) {
                newErrors.aadhar = "Invalid Aadhar: Repeating digits";
            }
        }

        if (!formData.pan || !formData.pan.trim()) {
            newErrors.pan = "PAN number is required";
        } else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.pan.toUpperCase())) {
            newErrors.pan = "Invalid PAN number format (e.g., ABCDE1234F)";
        }

        if (isEditMode) {
            // Edit Mode: Password is optional
            if (formData.password && formData.password.length < 8) {
                newErrors.password = "Password must be at least 8 characters";
            }
            if (formData.password && formData.password !== formData.confirmPassword) {
                newErrors.confirmPassword = "Passwords do not match";
            }
        } else {
            // Add Mode: Password is required
            if (!formData.password) {
                newErrors.password = "Password is required";
            } else if (formData.password.length < 8) {
                newErrors.password = "Password must be at least 8 characters";
            }

            if (formData.password !== formData.confirmPassword) {
                newErrors.confirmPassword = "Passwords do not match";
            }
        }

        setErrors(newErrors);
        return { isValid: Object.keys(newErrors).length === 0, newErrors };
    };

    const validateDistributor = () => {
        let newErrors = {};
        if (!distributorFormData.name.trim()) newErrors.name = "Name is required";
        if (!distributorFormData.email.trim()) {
            newErrors.email = "Email is required";
        } else if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,3}$/.test(distributorFormData.email)) {
            newErrors.email = "Invalid email format";
        }

        if (!distributorFormData.phone.trim()) {
            newErrors.phone = "Phone number is required";
        } else {
            const cleanPhone = distributorFormData.phone.replace(/\D/g, '');
            if (!/^[6789]\d{9}$/.test(cleanPhone)) {
                newErrors.phone = "Must be 10 digits starting with 6,7,8 or 9";
            } else if (/^(.)\1{8,9}$/.test(cleanPhone)) {
                newErrors.phone = "Invalid number: Repeating digits";
            }
        }

        if (!distributorFormData.address.trim()) newErrors.address = "Address is required";
        if (!distributorFormData.pincode.trim()) {
            newErrors.pincode = "Pincode is required";
        } else if (!/^\d{6}$/.test(distributorFormData.pincode)) {
            newErrors.pincode = "Pincode must be 6 digits";
        }

        if (!distributorFormData.aadharNumber || !distributorFormData.aadharNumber.trim()) {
            newErrors.aadharNumber = "Aadhar number is required";
        } else {
            const cleanAadharNum = distributorFormData.aadharNumber.replace(/\s/g, '');
            if (!/^\d{12}$/.test(cleanAadharNum)) {
                newErrors.aadharNumber = "Aadhar number must be 12 digits";
            } else if (/(.)\1{7,}/.test(cleanAadharNum)) {
                newErrors.aadharNumber = "Invalid Aadhar: Repeating digits";
            }
        }

        if (!distributorFormData.panNumber || !distributorFormData.panNumber.trim()) {
            newErrors.panNumber = "PAN number is required";
        } else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(distributorFormData.panNumber.toUpperCase())) {
            newErrors.panNumber = "Invalid PAN number format";
        }

        if (isDistributorEditMode) {
            // Edit Mode: Password is optional
            if (distributorFormData.password && distributorFormData.password.length < 8) {
                newErrors.password = "Password must be at least 8 characters";
            }
            if (distributorFormData.password && distributorFormData.password !== distributorFormData.confirmPassword) {
                newErrors.confirmPassword = "Passwords do not match";
            }
        } else {
            // Add Mode: Password is required
            if (!distributorFormData.password) {
                newErrors.password = "Password is required";
            } else if (distributorFormData.password.length < 8) {
                newErrors.password = "Password must be at least 8 characters";
            }

            if (distributorFormData.password !== distributorFormData.confirmPassword) {
                newErrors.confirmPassword = "Passwords do not match";
            }
        }

        setDistributorErrors(newErrors);
        return { isValid: Object.keys(newErrors).length === 0, newErrors };
    };

    const handleDelete = (id) => {
        const performDelete = async () => {
            try {
                const response = await fetch(`${BACKEND_URL}/api/drivers/${id}`, {
                    method: 'DELETE',
                });
                if (!response.ok) throw new Error("Failed to delete driver");
                if (onUpdateDeliveryBoys) onUpdateDeliveryBoys(deliveryBoys.filter(b => b.id !== id));
                Alert.alert("Success", "Delivery partner removed.");
            } catch (error) {
                Alert.alert("Error", error.message);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm("Remove this driver?")) {
                performDelete();
            }
        } else {
            Alert.alert("Confirm", "Remove this driver?", [{ text: "Cancel" }, { text: "Yes", onPress: performDelete }]);
        }
    };

    const handleDeleteDistributor = (id) => {
        const performDelete = async () => {
            try {
                const response = await fetch(`${BACKEND_URL}/api/distributors/${id}`, {
                    method: 'DELETE',
                });
                if (!response.ok) throw new Error("Failed to delete distributor");
                if (onUpdateDistributors) onUpdateDistributors(distributors.filter(d => d.id !== id));
                Alert.alert("Success", "Distributor removed.");
            } catch (error) {
                Alert.alert("Error", error.message);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm("Remove this distributor?")) {
                performDelete();
            }
        } else {
            Alert.alert("Confirm", "Remove this distributor?", [{ text: "Cancel" }, { text: "Yes", onPress: performDelete }]);
        }
    };

    const pickDistributorImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 1,
        });

        if (!result.canceled) {
            setDistributorFormData({ ...distributorFormData, photo: result.assets[0].uri });
        }
    };

    const [isAddingDistributor, setIsAddingDistributor] = useState(false);

    const handleAddDistributor = async () => {
        const { isValid, newErrors } = validateDistributor();
        if (!isValid) {
            Alert.alert("Validation Error", "Please correct the highlighted errors.");
            return;
        }

        setIsAddingDistributor(true);
        const payload = {
            name: distributorFormData.name,
            email: distributorFormData.email,
            phone: distributorFormData.phone,
            address: distributorFormData.address,
            pincode: distributorFormData.pincode,
            aadharNumber: distributorFormData.aadharNumber,
            panNumber: distributorFormData.panNumber,
            photoUrl: distributorFormData.photo,
        };

        if (distributorFormData.password) {
            payload.password = distributorFormData.password;
            payload.confirmPassword = distributorFormData.confirmPassword;
        } else if (!isDistributorEditMode) {
            Alert.alert("Error", "Password is required for new distributors.");
            setIsAddingDistributor(false);
            return;
        }

        try {
            const url = isDistributorEditMode ? `${BACKEND_URL}/api/distributors/${selectedDistributorId}` : `${BACKEND_URL}/api/distributors`;
            const method = isDistributorEditMode ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || (isDistributorEditMode ? "Failed to update distributor" : "Failed to add distributor"));
            }

            const savedDistributor = await response.json();
            if (onUpdateDistributors) {
                if (isDistributorEditMode) {
                    const updatedList = distributors.map(dist => dist.id === savedDistributor.id ? savedDistributor : dist);
                    onUpdateDistributors(updatedList);
                } else {
                    onUpdateDistributors([...distributors, savedDistributor]);
                }
            }

            setIsDistributorModalVisible(false); // Close modal
            // Reset form
            setDistributorFormData({ name: '', email: '', phone: '', address: '', pincode: '', aadharNumber: '', panNumber: '', photo: null, password: '', confirmPassword: '' });
            setDistributorErrors({});
            Alert.alert("Success", isDistributorEditMode ? "Distributor details updated." : "New distributor added successfully.");

        } catch (error) {
            console.error("Error saving distributor:", error);
            Alert.alert("Error", error.message || "Network error while saving distributor.");
        } finally {
            setIsAddingDistributor(false);
        }
    };

    const openAddDistributorModal = () => {
        setIsDistributorEditMode(false);
        setSelectedDistributorId(null);
        setDistributorFormData({ name: '', email: '', phone: '', address: '', pincode: '', aadharNumber: '', panNumber: '', photo: null, password: '', confirmPassword: '' });
        setDistributorErrors({});
        setIsDistributorModalVisible(true);
    };

    const handleEditDistributor = (distributor) => {
        setIsDistributorEditMode(true);
        setSelectedDistributorId(distributor.id);
        setDistributorFormData({
            name: distributor.name || '',
            email: distributor.email || '',
            phone: distributor.phone || '',
            address: distributor.address || '',
            pincode: distributor.pincode || '',
            aadharNumber: distributor.aadharNumber || '',
            panNumber: distributor.panNumber || '',
            photo: distributor.photoUrl || null,
            password: '',
            confirmPassword: ''
        });
        setDistributorErrors({});
        setIsDistributorModalVisible(true);
    };

    const openAddModal = () => {
        setIsEditMode(false);
        setSelectedDriverId(null);
        setFormData({ name: '', email: '', phone: '', address: '', vehicleNumber: '', vehicleType: 'Bike', aadhar: '', pan: '', photo: null, password: '', confirmPassword: '' });
        setErrors({});
        setIsModalVisible(true);
    };

    const handleEdit = (driver) => {
        setIsEditMode(true);
        setSelectedDriverId(driver.id);
        setFormData({
            name: driver.name || '',
            email: driver.email || '',
            phone: driver.phone || '',
            address: driver.address || '',
            vehicleNumber: driver.vehicleNumber || '',
            vehicleType: driver.vehicleType || 'Bike',
            aadhar: driver.aadharNumber || '',
            pan: driver.panNumber || '',
            photo: driver.photoUrl || null,
            password: '', // Don't pre-fill password for security
            confirmPassword: ''
        });
        setErrors({});
        setIsModalVisible(true);
    };

    const handleAddDeliveryBoy = async () => {
        const { isValid, newErrors } = validate();
        if (!isValid) {
            Alert.alert("Validation Error", "Please correct the highlighted errors.");
            return;
        }

        const payload = {
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            address: formData.address,
            vehicleNumber: formData.vehicleNumber || 'Pending',
            vehicleType: formData.vehicleType,
            status: 'active',
            aadharNumber: formData.aadhar,
            panNumber: formData.pan,
            photoUrl: formData.photo,
        };

        // Only include password if provided (it's optional in edit mode)
        if (formData.password) {
            payload.password = formData.password;
            payload.confirmPassword = formData.confirmPassword;
        } else if (!isEditMode) {
            // Should be caught by validate, but safe-guard
            Alert.alert("Error", "Password is required for new drivers.");
            return;
        }

        try {
            const url = isEditMode ? `${BACKEND_URL}/api/drivers/${selectedDriverId}` : `${BACKEND_URL}/api/drivers`;
            const method = isEditMode ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || (isEditMode ? "Failed to update driver" : "Failed to add driver"));
            }

            const savedDriver = await response.json();

            if (onUpdateDeliveryBoys) {
                if (isEditMode) {
                    const updatedList = deliveryBoys.map(boy => boy.id === savedDriver.id ? savedDriver : boy);
                    onUpdateDeliveryBoys(updatedList);
                } else {
                    onUpdateDeliveryBoys([...deliveryBoys, savedDriver]);
                }
            }

            setIsModalVisible(false);
            setFormData({ name: '', email: '', phone: '', address: '', vehicleNumber: '', vehicleType: 'Bike', aadhar: '', pan: '', photo: null, password: '', confirmPassword: '' });
            setErrors({});
            Alert.alert("Success", isEditMode ? "Driver details updated." : "New delivery partner added to fleet.");

        } catch (error) {
            console.error("Error saving driver:", error);
            Alert.alert("Error", error.message || "Network error.");
        }
    };

    return (
        <View style={{ flex: 1 }}>
            <ScrollView style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <View>
                        <Text style={{ fontSize: 26, fontWeight: '800', color: '#F8FAFC', marginBottom: 6, letterSpacing: -0.5 }}>Fleet Management</Text>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <TouchableOpacity onPress={() => setViewMode('drivers')}>
                                <Text style={{ color: viewMode === 'drivers' ? '#10B981' : '#64748B', fontWeight: '700', fontSize: 13, textDecorationLine: viewMode === 'drivers' ? 'underline' : 'none' }}>Drivers</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setViewMode('distributors')}>
                                <Text style={{ color: viewMode === 'distributors' ? '#10B981' : '#64748B', fontWeight: '700', fontSize: 13, textDecorationLine: viewMode === 'distributors' ? 'underline' : 'none' }}>Distributors</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    <TouchableOpacity
                        onPress={() => setIsSelectionModalVisible(true)}
                        style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center', shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}
                    >
                        <Plus size={24} color="#FFF" />
                    </TouchableOpacity>
                </View>

                {viewMode === 'drivers' ? (
                    <View style={{ gap: 16 }}>
                        {deliveryBoys.map((boy) => (
                            <Card key={boy.id} style={{ backgroundColor: '#1e293b', borderWidth: 0, borderRadius: 24, padding: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12 }}>
                                <CardHeader style={{ padding: 16 }}>
                                    <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
                                        <View style={{ width: 56, height: 56, borderRadius: 20, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center', shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6 }}>
                                            <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 20 }}>{boy.name.split(' ').map(n => n[0]).join('')}</Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <CardTitle style={{ color: '#F8FAFC', fontSize: 18, fontWeight: '700' }}>{boy.name}</CardTitle>
                                                <ShieldCheck size={16} color="#10B981" />
                                            </View>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: boy.status === 'active' ? '#10B981' : '#EF4444' }} />
                                                <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>{boy.status}</Text>
                                            </View>
                                        </View>
                                        <TouchableOpacity onPress={() => handleDelete(boy.id)} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(239, 68, 68, 0.08)', justifyContent: 'center', alignItems: 'center' }}>
                                            <Trash2 size={18} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                                </CardHeader>
                                <CardContent style={{ padding: 16, paddingTop: 0 }}>
                                    <View style={{ backgroundColor: '#0f172a', padding: 16, borderRadius: 20, marginBottom: 16, gap: 10 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                            <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(16, 185, 129, 0.1)', justifyContent: 'center', alignItems: 'center' }}>
                                                <Phone size={14} color="#10B981" strokeWidth={2.5} />
                                            </View>
                                            <Text style={{ color: '#F8FAFC', fontSize: 13, fontWeight: '700' }}>{boy.phone}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                            <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(16, 185, 129, 0.1)', justifyContent: 'center', alignItems: 'center' }}>
                                                <Mail size={14} color="#10B981" strokeWidth={2.5} />
                                            </View>
                                            <Text style={{ color: '#F8FAFC', fontSize: 13, fontWeight: '700' }}>{boy.email || 'No Email'}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                            <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(16, 185, 129, 0.1)', justifyContent: 'center', alignItems: 'center' }}>
                                                {boy.vehicleType === 'Bike' ? <Bike size={14} color="#10B981" strokeWidth={2.5} /> : <Truck size={14} color="#10B981" strokeWidth={2.5} />}
                                            </View>
                                            <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '600' }}>{boy.vehicleType} • <Text style={{ color: '#F8FAFC' }}>{boy.vehicleNumber}</Text></Text>
                                        </View>
                                    </View>

                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 }}>
                                        <View>
                                            <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 2 }}>Efficiency Stats</Text>
                                            <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '800' }}>{boy.deliveriesCompleted} <Text style={{ fontSize: 11, fontWeight: '500', color: '#94A3B8' }}>Successful Deliveries</Text></Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => handleEdit(boy)}
                                            style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#334155', flexDirection: 'row', alignItems: 'center', gap: 6 }}
                                        >
                                            <Edit size={14} color="#94A3B8" />
                                            <Text style={{ color: '#94A3B8', fontWeight: '700', fontSize: 13 }}>Modify</Text>
                                        </TouchableOpacity>
                                    </View>
                                </CardContent>
                            </Card>
                        ))}
                    </View>
                ) : (
                    <View style={{ gap: 16 }}>
                        {distributors.length === 0 ? (
                            <View style={{ alignItems: 'center', padding: 40, backgroundColor: '#1e293b', borderRadius: 24 }}>
                                <Store size={40} color="#64748B" />
                                <Text style={{ color: '#94A3B8', marginTop: 16 }}>No distributors added yet.</Text>
                            </View>
                        ) : (
                            distributors.map((dist) => (
                                <Card key={dist.id} style={{ backgroundColor: '#1e293b', borderWidth: 0, borderRadius: 24, padding: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12 }}>
                                    <CardHeader style={{ padding: 16 }}>
                                        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
                                            <View style={{ width: 56, height: 56, borderRadius: 20, backgroundColor: '#7C3AED', justifyContent: 'center', alignItems: 'center', shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6 }}>
                                                {dist.photoUrl ? (
                                                    <Image source={{ uri: dist.photoUrl }} style={{ width: 56, height: 56, borderRadius: 20 }} />
                                                ) : (
                                                    <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 20 }}>{dist.name ? dist.name[0] : 'D'}</Text>
                                                )}
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <CardTitle style={{ color: '#F8FAFC', fontSize: 18, fontWeight: '700' }}>{dist.name}</CardTitle>
                                                <Text style={{ color: '#94A3B8', fontSize: 13 }}>{dist.address || 'No Address'}</Text>
                                            </View>
                                            <TouchableOpacity onPress={() => handleDeleteDistributor(dist.id)} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(239, 68, 68, 0.08)', justifyContent: 'center', alignItems: 'center' }}>
                                                <Trash2 size={18} color="#EF4444" />
                                            </TouchableOpacity>
                                        </View>
                                    </CardHeader>
                                    <CardContent style={{ padding: 16, paddingTop: 0 }}>
                                        <View style={{ backgroundColor: '#0f172a', padding: 16, borderRadius: 20, marginBottom: 16, gap: 10 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                                <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(124, 58, 237, 0.1)', justifyContent: 'center', alignItems: 'center' }}>
                                                    <Phone size={14} color="#7C3AED" strokeWidth={2.5} />
                                                </View>
                                                <Text style={{ color: '#F8FAFC', fontSize: 13, fontWeight: '700' }}>{dist.phone}</Text>
                                            </View>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                                <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(124, 58, 237, 0.1)', justifyContent: 'center', alignItems: 'center' }}>
                                                    <Mail size={14} color="#7C3AED" strokeWidth={2.5} />
                                                </View>
                                                <Text style={{ color: '#F8FAFC', fontSize: 13, fontWeight: '700' }}>{dist.email || 'No Email'}</Text>
                                            </View>
                                            {dist.pincode ? (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                                    <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(124, 58, 237, 0.1)', justifyContent: 'center', alignItems: 'center' }}>
                                                        <Truck size={14} color="#7C3AED" strokeWidth={2.5} />
                                                    </View>
                                                    <Text style={{ color: '#F8FAFC', fontSize: 13, fontWeight: '700' }}>PIN: {dist.pincode}</Text>
                                                </View>
                                            ) : null}
                                        </View>

                                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 4 }}>
                                            <TouchableOpacity
                                                onPress={() => handleEditDistributor(dist)}
                                                style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#334155', flexDirection: 'row', alignItems: 'center', gap: 6 }}
                                            >
                                                <Edit size={14} color="#94A3B8" />
                                                <Text style={{ color: '#94A3B8', fontWeight: '700', fontSize: 13 }}>Modify</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </View>
                )}
            </ScrollView>

            {/* Selection Modal */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={isSelectionModalVisible}
                onRequestClose={() => setIsSelectionModalVisible(false)}
            >
                <TouchableOpacity
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
                    activeOpacity={1}
                    onPress={() => setIsSelectionModalVisible(false)}
                >
                    <View style={{ backgroundColor: '#1e293b', borderRadius: 24, padding: 24, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: '#334155' }}>
                        <Text style={{ fontSize: 20, fontWeight: '800', color: '#F8FAFC', marginBottom: 20, textAlign: 'center' }}>Select Type to Add</Text>

                        <View style={{ gap: 16 }}>
                            <TouchableOpacity
                                onPress={() => {
                                    setIsSelectionModalVisible(false);
                                    openAddModal();
                                }}
                                style={{
                                    backgroundColor: '#0f172a',
                                    padding: 20,
                                    borderRadius: 16,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 16,
                                    borderWidth: 1,
                                    borderColor: '#334155'
                                }}
                            >
                                <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: 'rgba(124, 58, 237, 0.1)', justifyContent: 'center', alignItems: 'center' }}>
                                    <Truck size={24} color="#7C3AED" />
                                </View>
                                <View>
                                    <Text style={{ color: '#F8FAFC', fontSize: 16, fontWeight: '700' }}>Add Delivery Boy</Text>
                                    <Text style={{ color: '#94A3B8', fontSize: 13 }}>Register a new internal fleet driver</Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => {
                                    setIsSelectionModalVisible(false);
                                    openAddDistributorModal();
                                }}
                                style={{
                                    backgroundColor: '#0f172a',
                                    padding: 20,
                                    borderRadius: 16,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 16,
                                    borderWidth: 1,
                                    borderColor: '#334155'
                                }}
                            >
                                <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: 'rgba(16, 185, 129, 0.1)', justifyContent: 'center', alignItems: 'center' }}>
                                    <Store size={24} color="#10B981" />
                                </View>
                                <View>
                                    <Text style={{ color: '#F8FAFC', fontSize: 16, fontWeight: '700' }}>Add Distributor</Text>
                                    <Text style={{ color: '#94A3B8', fontSize: 13 }}>Register an external distribution partner</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Add Distributor Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={isDistributorModalVisible}
                onRequestClose={() => setIsDistributorModalVisible(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 }}
                >
                    <View style={{ backgroundColor: '#0f172a', borderRadius: 24, padding: 24, maxHeight: '90%', borderWidth: 1, borderColor: '#334155' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <View>
                                <Text style={{ fontSize: 20, fontWeight: '800', color: '#F8FAFC' }}>{isDistributorEditMode ? 'Edit Distributor' : 'Add Distributor'}</Text>
                                <Text style={{ color: '#94A3B8', fontSize: 12 }}>{isDistributorEditMode ? 'Update partner details' : 'Register a new partner distributor'}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setIsDistributorModalVisible(false)} style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: 'rgba(239, 68, 68, 0.15)', justifyContent: 'center', alignItems: 'center' }}>
                                <X size={20} color="#EF4444" strokeWidth={2.5} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            <Input label="Distributor Name" placeholder="e.g. Alpha Logistics" value={distributorFormData.name} onChangeText={(t) => handleDistributorInputChange('name', t)} error={distributorErrors.name} />
                            <Input label="Email" placeholder="contact@example.com" value={distributorFormData.email} onChangeText={(t) => handleDistributorInputChange('email', t)} keyboardType="email-address" error={distributorErrors.email} />
                            <Input label="Contact Phone" placeholder="98765 43210" value={distributorFormData.phone} onChangeText={(t) => handleDistributorInputChange('phone', t)} keyboardType="phone-pad" maxLength={10} error={distributorErrors.phone} />
                            <Input label="Office Address" placeholder="Enter full address" value={distributorFormData.address} onChangeText={(t) => handleDistributorInputChange('address', t)} error={distributorErrors.address} />
                            <Input label="Pincode" placeholder="e.g. 110001" value={distributorFormData.pincode} onChangeText={(t) => handleDistributorInputChange('pincode', t)} keyboardType="numeric" maxLength={6} error={distributorErrors.pincode} />

                            <Input label="Aadhar Number" placeholder="12-digit UIDAI Number" value={distributorFormData.aadharNumber} onChangeText={(t) => handleDistributorInputChange('aadharNumber', t)} keyboardType="numeric" maxLength={12} error={distributorErrors.aadharNumber} />
                            <Input label="PAN Number" placeholder="ABCDE1234F" value={distributorFormData.panNumber} onChangeText={(t) => handleDistributorInputChange('panNumber', t.toUpperCase())} autoCapitalize="characters" maxLength={10} error={distributorErrors.panNumber} />

                            <Input label="Password" placeholder="••••••••" value={distributorFormData.password} onChangeText={(t) => handleDistributorInputChange('password', t)} secureTextEntry={true} error={distributorErrors.password} />
                            <Input label="Confirm Password" placeholder="••••••••" value={distributorFormData.confirmPassword} onChangeText={(t) => handleDistributorInputChange('confirmPassword', t)} secureTextEntry={true} error={distributorErrors.confirmPassword} />

                            {/* Photo Input for Distributor */}
                            <View style={{ marginBottom: 24 }}>
                                <Text style={{ color: '#F8FAFC', fontSize: 13, fontWeight: '700', marginBottom: 8 }}>Distributor Photo / Logo</Text>
                                <TouchableOpacity
                                    onPress={pickDistributorImage}
                                    style={{ backgroundColor: '#1e293b', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#334155', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <View style={{ backgroundColor: '#334155', padding: 6, borderRadius: 8 }}>
                                        <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>Choose file</Text>
                                    </View>
                                    {distributorFormData.photo ? (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                            <Image source={{ uri: distributorFormData.photo }} style={{ width: 40, height: 40, borderRadius: 8 }} />
                                            <Text style={{ color: '#F8FAFC', fontSize: 12 }}>Image Selected</Text>
                                        </View>
                                    ) : (
                                        <Text style={{ color: '#64748B', fontSize: 13 }}>No file chosen</Text>
                                    )}
                                </TouchableOpacity>
                            </View>

                            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 40 }}>
                                <TouchableOpacity
                                    onPress={handleAddDistributor}
                                    disabled={isAddingDistributor}
                                    style={{ flex: 2, backgroundColor: '#10B981', paddingVertical: 14, borderRadius: 12, alignItems: 'center', opacity: isAddingDistributor ? 0.7 : 1 }}>
                                    <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15 }}>{isAddingDistributor ? 'Processing...' : (isDistributorEditMode ? 'Update Distributor' : '+   Add Distributor')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setIsDistributorModalVisible(false)}
                                    style={{ flex: 1, backgroundColor: 'transparent', paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#334155' }}>
                                    <Text style={{ color: '#F8FAFC', fontWeight: '700', fontSize: 15 }}>Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            <Modal
                animationType="slide"
                transparent={true}
                visible={isModalVisible}
                onRequestClose={() => setIsModalVisible(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 }}
                >
                    <View style={{ backgroundColor: '#0f172a', borderRadius: 24, padding: 24, maxHeight: '90%', borderWidth: 1, borderColor: '#334155' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <View>
                                <Text style={{ fontSize: 20, fontWeight: '800', color: '#F8FAFC' }}>{isEditMode ? 'Edit Delivery Boy' : 'Add New Delivery Boy'}</Text>
                                <Text style={{ color: '#94A3B8', fontSize: 12 }}>{isEditMode ? 'Update driver details' : 'Add a new delivery person to your team'}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setIsModalVisible(false)} style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: 'rgba(239, 68, 68, 0.15)', justifyContent: 'center', alignItems: 'center' }}>
                                <X size={20} color="#EF4444" strokeWidth={2.5} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            <Input label="Full Name" placeholder="Enter full name" value={formData.name} onChangeText={(t) => handleInputChange('name', t)} error={errors.name} />
                            <Input label="Email" placeholder="email@example.com" value={formData.email} onChangeText={(t) => handleInputChange('email', t)} keyboardType="email-address" error={errors.email} />
                            <Input label="Phone Number" placeholder="98765 43210" value={formData.phone} onChangeText={(t) => handleInputChange('phone', t)} keyboardType="phone-pad" maxLength={10} error={errors.phone} />
                            <Input label="Address" placeholder="Enter address" value={formData.address} onChangeText={(t) => handleInputChange('address', t)} error={errors.address} />

                            <Input label="Vehicle Number" placeholder="DL-01-AB-1234" value={formData.vehicleNumber} onChangeText={(t) => handleInputChange('vehicleNumber', t)} autoCapitalize="characters" error={errors.vehicleNumber} />

                            {/* Vehicle Type Dropdown */}
                            <View style={{ marginBottom: 16, zIndex: 100 }}>
                                <Text style={{ color: '#F8FAFC', fontSize: 13, fontWeight: '700', marginBottom: 8 }}>Vehicle Type</Text>
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={() => setIsDropdownOpen(!isDropdownOpen)}
                                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1e293b', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: '#334155' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                        {formData.vehicleType === 'Bike' ? <Bike size={20} color="#10B981" /> : <Truck size={20} color="#10B981" />}
                                        <Text style={{ color: '#F8FAFC', fontSize: 14 }}>{formData.vehicleType}</Text>
                                    </View>
                                    <ChevronDown size={18} color="#94A3B8" strokeWidth={3} />
                                </TouchableOpacity>

                                {isDropdownOpen && (
                                    <View style={{ position: 'absolute', top: 70, left: 0, right: 0, backgroundColor: '#1e293b', borderRadius: 12, borderWidth: 1, borderColor: '#334155', zIndex: 200, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}>
                                        {['Bike', 'Truck', 'Auto'].map((type, idx) => (
                                            <TouchableOpacity
                                                key={type}
                                                onPress={() => {
                                                    setFormData({ ...formData, vehicleType: type });
                                                    setIsDropdownOpen(false);
                                                }}
                                                style={{
                                                    paddingVertical: 12,
                                                    paddingHorizontal: 16,
                                                    borderBottomWidth: idx === 2 ? 0 : 1,
                                                    borderBottomColor: '#334155',
                                                    backgroundColor: formData.vehicleType === type ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    gap: 12
                                                }}
                                            >
                                                {type === 'Bike' ? <Bike size={18} color={formData.vehicleType === type ? '#10B981' : '#64748B'} /> : <Truck size={18} color={formData.vehicleType === type ? '#10B981' : '#64748B'} />}
                                                <Text style={{ color: formData.vehicleType === type ? '#10B981' : '#F8FAFC', fontSize: 14, fontWeight: formData.vehicleType === type ? '700' : '400' }}>{type}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>

                            <Input label="Aadhar Number" placeholder="12-digit UIDAI Number" value={formData.aadhar} onChangeText={(t) => handleInputChange('aadhar', t)} keyboardType="numeric" maxLength={12} error={errors.aadhar} />
                            <Input label="PAN Number" placeholder="ABCDE1234F" value={formData.pan} onChangeText={(t) => handleInputChange('pan', t.toUpperCase())} autoCapitalize="characters" maxLength={10} error={errors.pan} />

                            <Input label="Enter Password" placeholder="••••••••" value={formData.password} onChangeText={(t) => handleInputChange('password', t)} secureTextEntry={true} error={errors.password} />
                            <Input label="Confirm Password" placeholder="••••••••" value={formData.confirmPassword} onChangeText={(t) => handleInputChange('confirmPassword', t)} secureTextEntry={true} error={errors.confirmPassword} />

                            {/* Photo Input */}
                            <View style={{ marginBottom: 24 }}>
                                <Text style={{ color: '#F8FAFC', fontSize: 13, fontWeight: '700', marginBottom: 8 }}>Photo</Text>
                                <TouchableOpacity
                                    onPress={pickImage}
                                    style={{ backgroundColor: '#1e293b', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#334155', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <View style={{ backgroundColor: '#334155', padding: 6, borderRadius: 8 }}>
                                        <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>Choose file</Text>
                                    </View>
                                    {formData.photo ? (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                            <Image source={{ uri: formData.photo }} style={{ width: 40, height: 40, borderRadius: 8 }} />
                                            <Text style={{ color: '#F8FAFC', fontSize: 12 }}>Image Selected</Text>
                                        </View>
                                    ) : (
                                        <Text style={{ color: '#64748B', fontSize: 13 }}>No file chosen</Text>
                                    )}
                                </TouchableOpacity>
                            </View>

                            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                                <TouchableOpacity
                                    onPress={handleAddDeliveryBoy}
                                    style={{ flex: 2, backgroundColor: '#10B981', paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}>
                                    <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15 }}>{isEditMode ? 'Update Delivery Boy' : '+   Add Delivery Boy'}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setIsModalVisible(false)}
                                    style={{ flex: 1, backgroundColor: 'transparent', paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#334155' }}>
                                    <Text style={{ color: '#F8FAFC', fontWeight: '700', fontSize: 15 }}>Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View >
    );
}


