import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, StatusBar, Alert, Platform, Image } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Package, Truck, QrCode, LayoutDashboard, Navigation, RotateCcw, User, IndianRupee, Activity, CheckCircle, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { ShipmentDashboard } from './src/components/shipment-dashboard';
import { ShipmentCollection } from './src/components/shipment-collection';
import { PackageLabeling } from './src/components/package-labeling';
import { DistributionReady } from './src/components/distribution-ready';
import { TransitDelivery } from './src/components/transit-delivery';
import { ReturnManagement } from './src/components/return-management';
import { DeliveryBoyManagement } from './src/components/delivery-boy-management';
import { CashCollection } from './src/components/cash-collection';
import { LoginPage } from './src/components/login-page';
import { ProfilePopup } from './src/components/profile-popup';
import { DeliveryHistory } from './src/components/delivery-history';

import { BACKEND_URL } from './src/config';
import io from 'socket.io-client';
import LogoSource from './assets/logo.png';

const initialShipments = [];

const initialDeliveryBoys = [];

export default function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [profileVisible, setProfileVisible] = useState(false);
    const [shipments, setShipments] = useState(initialShipments);
    const [returnShipments, setReturnShipments] = useState([]);
    const [deliveryBoys, setDeliveryBoys] = useState(initialDeliveryBoys);
    const [distributors, setDistributors] = useState([]);
    const [currentUser, setCurrentUser] = useState({ email: '', name: '', phone: '' });
    const [isPrinting, setIsPrinting] = useState(false);
    const [activities, setActivities] = useState([]);
    const [downloadedSlots, setDownloadedSlots] = useState({}); // Hoisted state
    const [toastMessage, setToastMessage] = useState(null);
    const [toastType, setToastType] = useState('order');

    const [unreadCollectionCount, setUnreadCollectionCount] = useState(0);
    const [unreadReturnsCount, setUnreadReturnsCount] = useState(0);

    const activeTabRef = useRef(activeTab);
    useEffect(() => {
        activeTabRef.current = activeTab;
        if (activeTab === 'collection') {
            setUnreadCollectionCount(0);
        }
        if (activeTab === 'returns') {
            setUnreadReturnsCount(0);
        }
    }, [activeTab]);

    // Track orders undergoing local updates to prevent polling race conditions
    const lockedOrders = useRef(new Set());
    const lockTimers = useRef({});

    const lockOrder = (orderId) => {
        const id = orderId.toString();
        lockedOrders.current.add(id);

        // Clear existing timer if any
        if (lockTimers.current[id]) clearTimeout(lockTimers.current[id]);

        // Unlock after 15 seconds (enough time for DB write + next poll)
        lockTimers.current[id] = setTimeout(() => {
            lockedOrders.current.delete(id);
            delete lockTimers.current[id];
        }, 15000);
    };

    const unlockOrder = (orderId) => {
        const id = orderId.toString();
        lockedOrders.current.delete(id);
        if (lockTimers.current[id]) {
            clearTimeout(lockTimers.current[id]);
            delete lockTimers.current[id];
        }
    };

    // Load downloaded slots on mount (moved from ShipmentCollection)
    useEffect(() => {
        const loadStatus = async () => {
            try {
                const isWeb = Platform.OS === 'web';
                let AsyncStorage;
                if (isWeb) {
                    // Simple polyfill for web or just use localStorage if needed, 
                    // but react-native-web usually handles this. 
                    // Assuming @react-native-async-storage/async-storage works or we skip.
                    AsyncStorage = require('@react-native-async-storage/async-storage').default;
                } else {
                    AsyncStorage = require('@react-native-async-storage/async-storage').default;
                }

                if (AsyncStorage) {
                    const stored = await AsyncStorage.getItem('downloadedSlots');
                    if (stored) {
                        const parsed = JSON.parse(stored);
                        setDownloadedSlots(Array.isArray(parsed) ? {} : parsed);
                    }
                }
            } catch (e) { console.error("Failed to load download status", e); }
        };
        loadStatus();
    }, []);

    // Autohide toast notifications
    useEffect(() => {
        if (toastMessage) {
            const timer = setTimeout(() => {
                setToastMessage(null);
            }, 6000);
            return () => clearTimeout(timer);
        }
    }, [toastMessage]);

    const handleMarkAsDownloaded = async (slotId, orderIds) => {
        const updated = { ...downloadedSlots, [slotId]: orderIds };
        setDownloadedSlots(updated);
        try {
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            if (AsyncStorage) {
                await AsyncStorage.setItem('downloadedSlots', JSON.stringify(updated));
            }
        } catch (e) { console.error("Failed to save download status", e); }
    };

    const showAlert = (title, message) => {
        if (Platform.OS === 'web') {
            window.alert(`${title}: ${message}`);
        } else {
            Alert.alert(title, message);
        }
    };

    const logActivity = (type, message, icon = Package, color = '#64748B') => {
        const newActivity = {
            id: Date.now().toString(),
            type,
            message,
            timestamp: Date.now(),
            icon,
            color
        };
        setActivities(prev => {
            // Deduplicate same message within 2 seconds to avoid double logs (socket + poll overlap)
            if (prev.length > 0 && prev[0].message === message && Date.now() - prev[0].timestamp < 2000) {
                return prev;
            }
            return [newActivity, ...prev].slice(0, 20);
        });
    };

    const deduplicatePincode = (addr) => {
        if (!addr || typeof addr !== 'string') return addr;
        const regex = /(?:[\s,]+)?\b(\d{6})\b(?=[\s\S]*?\b(?:Pincode|PIN|Pin\s*Code|PinCode)\b\s*[:\-]?\s*\1\b)/gi;
        let result = addr.replace(regex, '');
        return result
            .replace(/,\s*,/g, ', ')
            .replace(/\s+,/g, ',')
            .replace(/^[,\s]+|[,\s]+$/g, '')
            .trim();
    };

    const formatOrder = (order) => {
        let parsedItems = [];
        try {
            parsedItems = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []);
        } catch (e) {
            if (typeof order.items === 'string' && order.items.trim().length > 0) {
                parsedItems = [{ name: order.items, qty: 1, price: 0 }];
            } else {
                parsedItems = [];
            }
        }

        let parsedPackageInfo = null;
        try {
            parsedPackageInfo = typeof order.packageInfo === 'string' ? JSON.parse(order.packageInfo) : order.packageInfo;
        } catch (e) { }

        let parsedDeliveryInfo = null;
        try {
            parsedDeliveryInfo = typeof order.deliveryInfo === 'string' ? JSON.parse(order.deliveryInfo) : order.deliveryInfo;
        } catch (e) { }

        const formatImages = (imgStrOrArr) => {
            let images = [];
            try {
                images = typeof imgStrOrArr === 'string' ? JSON.parse(imgStrOrArr) : (imgStrOrArr || []);
            } catch (e) {
                images = [];
            }
            if (!Array.isArray(images)) images = [images];
            return images.map(img => (img && img.startsWith('/')) ? BACKEND_URL + img : img);
        };

        return {
            ...order,
            customerAddress: deduplicatePincode(order.customerAddress),
            vendorAddress: deduplicatePincode(order.vendorAddress),
            vendorFullAddress: deduplicatePincode(order.vendorFullAddress),
            items: parsedItems,
            packageInfo: parsedPackageInfo,
            deliveryInfo: parsedDeliveryInfo,
            collectionPhotos: formatImages(order.collectionPhotos),
            deliveryProof: (order.deliveryProof && order.deliveryProof.startsWith('/')) ? BACKEND_URL + order.deliveryProof : order.deliveryProof,
            failurePhoto: (order.failurePhoto && order.failurePhoto.startsWith('/')) ? BACKEND_URL + order.failurePhoto : order.failurePhoto,
            id: order.id.toString()
        };
    };

    const formatReturn = (newReturn) => {
        let rawImages = newReturn.images;
        try {
            if (typeof rawImages === 'string' && (rawImages.startsWith('[') || rawImages.startsWith('{'))) {
                rawImages = JSON.parse(rawImages);
            }
        } catch (e) { }
        const images = Array.isArray(rawImages) ? rawImages : (rawImages ? [rawImages] : []);

        const isActuallyDist = (newReturn.distributorName && newReturn.distributorName !== 'Unknown' && newReturn.distributorName !== 'Unknown Distributor') ||
            (newReturn.driverName && newReturn.driverName.toLowerCase().includes('distributor'));

        return {
            id: newReturn.id,
            orderId: newReturn.orderId || newReturn.orderNo,
            returnId: newReturn.returnId,
            vendorName: newReturn.vendorName || 'Unknown Vendor',
            vendorAddress: deduplicatePincode(newReturn.vendorAddress || ''),
            vendorContact: newReturn.vendorContact || newReturn.VendorContactNumber || newReturn.vendorContactNumber || '',
            customerName: newReturn.customerName || newReturn.ShopName || 'Unknown Customer',

            customerAddress: deduplicatePincode(newReturn.customerAddress || newReturn.pickupAddress || newReturn.RetailerAddress || ''),
            customerContact: newReturn.customerContact || newReturn.RetailerContactNumber || newReturn.retailerContactNumber || '',
            items: [],


            totalAmount: newReturn.refundAmount || '0',
            status: 'return',
            returnInfo: {
                reason: newReturn.reason,
                rawStatus: newReturn.status,
                status: (() => {
                    const s = (newReturn.status || 'requested').toLowerCase().replace(/[^a-z]/g, '');
                    const reqType = (newReturn.requestType || '').toLowerCase().trim();
                    if (s === 'requested' || s === 'pending') return 'requested';
                    if (s === 'confirmedrequested' || s === 'confirmed') return 'confirmed-requested';
                    if (s === 'assigned' || s === 'accepted') return 'assigned';
                    if (s === 'intransit') return 'in-transit';
                    if (s === 'failed') return 'failed';
                    if (s === 'pickedupanddelivered' || s === 'pickeupanddelivered') return 'pickedupanddelivered';
                    if (s === 'approved' || s === 'received' || s === 'delivered' || s === 'completed' || s === 'pickedup' || s === 'pickedupd') {
                        return reqType === 'exchange' ? 'pickedupanddelivered' : 'received';
                    }

                    return 'requested';
                })(),
                requestDate: new Date(newReturn.createdAt || Date.now()).toLocaleDateString('en-GB'),
                isDownloaded: newReturn.isDownloaded === true || newReturn.isDownloaded === 1 || newReturn.isDownloaded === '1',
                isCompletedDownloaded: newReturn.isCompletedDownloaded === true || newReturn.isCompletedDownloaded === 1 || newReturn.isCompletedDownloaded === '1',
                isHubConfirmed: newReturn.isHubConfirmed === true || newReturn.isHubConfirmed === 1 || newReturn.isHubConfirmed === '1',
                exchangeImage: newReturn.exchangeImage,
                productName: newReturn.productName,
                productPrice: newReturn.productPrice,
                returnQuantity: newReturn.returnQuantity,
                orderedQuantity: newReturn.orderedQuantity,
                returnExchangeQuantity: newReturn.returnExchangeQuantity,
                requestType: newReturn.requestType,
                driverName: isActuallyDist ? null : newReturn.driverName,
                distributorName: isActuallyDist ? (newReturn.distributorName || newReturn.driverName) : null,
                images: images.map(img => (img && img.startsWith('/')) ? BACKEND_URL + img : img),
                productImageUrl: newReturn.productImageUrl ? BACKEND_URL + newReturn.productImageUrl : null,
                isRefund: newReturn.isRefund || 'Pending Refund',
                refundAmount: newReturn.refundAmount,
                isRetailer: newReturn.isRetailer
            }
        };
    };

    // Shared Socket Connection
    useEffect(() => {
        if (isAuthenticated) {
            const socket = io(BACKEND_URL, {
                transports: ['websocket'],
            });

            socket.on('connect', () => console.log('Connected to socket server'));

            socket.on('newOrder', (newOrder) => {
                console.log('New order received via socket:', newOrder.id);
                const formatted = formatOrder(newOrder);
                
                let isNew = false;
                setShipments(prev => {
                    if (prev.find(s => s.id === formatted.id)) return prev;
                    isNew = true;
                    return [formatted, ...prev];
                });

                if (isNew) {
                    setToastMessage(`New Order Received: #${formatted.orderId}`);
                    setToastType('order');
                    if (activeTabRef.current !== 'collection') {
                        setUnreadCollectionCount(c => c + 1);
                    }
                }
                logActivity('Order', `New order #${formatted.orderId} received`, Package, '#3B82F6');
            });

            socket.on('newReturn', (newReturn) => {
                console.log('New return received via socket:', newReturn.id);
                const formatted = formatReturn(newReturn);
                
                let isNew = false;
                setReturnShipments(prev => {
                    if (prev.find(r => r.id === formatted.id)) return prev;
                    isNew = true;
                    return [formatted, ...prev];
                });

                if (isNew) {
                    setToastMessage(`New Return Received: #${formatted.returnId || formatted.orderId}`);
                    setToastType('return');
                    if (activeTabRef.current !== 'returns') {
                        setUnreadReturnsCount(c => c + 1);
                    }
                }
                const logMsg = formatted.returnId ? `New return #${formatted.returnId} was added!` : `New return #${formatted.orderId} was added!`;
                logActivity('Return', logMsg, RotateCcw, '#EF4444');
            });

            socket.on('updateReturn', (updatedReturn) => {
                console.log('Return update received via socket:', updatedReturn.id, updatedReturn.status);
                setReturnShipments(prev => prev.map(r => {
                    if (r.id === updatedReturn.id) {
                        // Extract rawStatus to match formatReturn logic
                        const rawStatus = updatedReturn.status;
                        const s = (rawStatus || '').toLowerCase().replace(/[^a-z]/g, '');
                        const mappedStatus = (() => {
                            const reqType = (r.returnInfo.requestType || '').toLowerCase().trim();
                            if (s === 'requested' || s === 'pending') return 'requested';
                            if (s === 'confirmedrequested' || s === 'confirmed') return 'confirmed-requested';
                            if (s === 'assigned' || s === 'accepted') return 'assigned';
                            if (s === 'intransit') return 'in-transit';
                            if (s === 'failed') return 'failed';
                            if (s === 'pickedupanddelivered' || s === 'pickeupanddelivered') return 'pickedupanddelivered';
                            if (s === 'approved' || s === 'received' || s === 'delivered' || s === 'completed' || s === 'pickedup' || s === 'pickedupd') {
                                return reqType === 'exchange' ? 'pickedupanddelivered' : 'received';
                            }
                            return 'requested';
                        })();


                        return {
                            ...r,
                            returnInfo: {
                                ...r.returnInfo,
                                rawStatus: rawStatus,
                                status: mappedStatus,
                                isDownloaded: updatedReturn.isDownloaded === true || updatedReturn.isDownloaded === 1 || updatedReturn.isDownloaded === '1',
                                isCompletedDownloaded: updatedReturn.isCompletedDownloaded === true || updatedReturn.isCompletedDownloaded === 1 || updatedReturn.isCompletedDownloaded === '1',
                                isHubConfirmed: updatedReturn.isHubConfirmed === true || updatedReturn.isHubConfirmed === 1 || updatedReturn.isHubConfirmed === '1',
                                exchangeImage: updatedReturn.exchangeImage
                            }
                        };
                    }
                    return r;
                }));
            });

            socket.on('updateOrder', (updatedOrder) => {
                console.log('Order update received via socket:', updatedOrder.id, updatedOrder.status);
                const formatted = formatOrder(updatedOrder);

                // When a real update comes from socket, we can unlock
                unlockOrder(formatted.id);

                setShipments(prev => prev.map(s =>
                    s.id === formatted.id ? formatted : s
                ));
            });

            socket.on('disconnect', () => console.log('Disconnected from socket server'));

            return () => {
                socket.disconnect();
            };
        }
    }, [isAuthenticated]);

    // Polling for Orders
    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const response = await fetch(`${BACKEND_URL}/api/orders?_t=${Date.now()}`);
                if (response.ok) {
                    const data = await response.json();
                    const rawOrders = Array.isArray(data) ? data : (data && Array.isArray(data.value) ? data.value : []);
                    if (rawOrders) {
                        const formattedOrders = rawOrders.map(formatOrder);
                        setShipments(prev => {
                            // Map existing shipments, but keep local "locked" data if the server is still stale
                            const merged = formattedOrders.map(serverOrder => {
                                if (lockedOrders.current.has(serverOrder.id)) {
                                    const localOrder = prev.find(p => p.id === serverOrder.id);
                                    if (localOrder && localOrder.status !== serverOrder.status) {
                                        console.log(`[POLLING-SYNC] Preserving local status for locked order ${serverOrder.id}: ${localOrder.status} (Server still says ${serverOrder.status})`);
                                        return localOrder;
                                    }
                                }
                                return serverOrder;
                            });

                            if (JSON.stringify(prev) !== JSON.stringify(merged)) {
                                return merged;
                            }
                            return prev;
                        });
                    }
                }
            } catch (error) {
                console.log('Failed to fetch orders from backend:', error);
            }
        };

        if (isAuthenticated) {
            fetchOrders();
            const interval = setInterval(fetchOrders, 15000); // Polling reduced to 15s to favor socket updates
            return () => clearInterval(interval);
        }
    }, [isAuthenticated]);

    // Polling for Returns
    useEffect(() => {
        const fetchReturns = async () => {
            try {
                const response = await fetch(`${BACKEND_URL}/api/returns`);
                if (response.ok) {
                    const data = await response.json();
                    if (data && Array.isArray(data)) {
                        const formattedReturns = data.map(formatReturn);
                        setReturnShipments(prev => {
                            if (JSON.stringify(prev) !== JSON.stringify(formattedReturns)) {
                                return formattedReturns;
                            }
                            return prev;
                        });
                    }
                }
            } catch (error) {
                console.log('Failed to fetch returns:', error);
            }
        };

        if (isAuthenticated) {
            fetchReturns();
            const interval = setInterval(fetchReturns, 5000); // Poll every 5 seconds as fallback
            return () => clearInterval(interval);
        }
    }, [isAuthenticated]);

    // Fetch delivery boys from backend
    useEffect(() => {
        const fetchDeliveryBoys = async () => {
            try {
                const response = await fetch(`${BACKEND_URL}/api/drivers`);
                if (response.ok) {
                    const data = await response.json();
                    if (Array.isArray(data)) {
                        setDeliveryBoys(data);
                    }
                }
            } catch (error) {
                console.log('Failed to fetch delivery boys:', error);
            }
        };

        if (isAuthenticated) {
            fetchDeliveryBoys();
        }
    }, [isAuthenticated]);

    // Fetch distributors from backend
    useEffect(() => {
        const fetchDistributors = async () => {
            try {
                const response = await fetch(`${BACKEND_URL}/api/distributors`);
                if (response.ok) {
                    const data = await response.json();
                    if (Array.isArray(data)) {
                        setDistributors(data);
                    }
                }
            } catch (error) {
                console.log('Failed to fetch distributors:', error);
            }
        };

        if (isAuthenticated) {
            fetchDistributors();
        }
    }, [isAuthenticated]);

    useEffect(() => {
        if (Platform.OS === 'web') {
            const mediaQueryList = window.matchMedia('print');
            const listener = (mql) => {
                setIsPrinting(mql.matches);
            };
            // Add listener
            if (mediaQueryList.addListener) {
                mediaQueryList.addListener(listener);
            } else {
                mediaQueryList.addEventListener('change', listener);
            }

            return () => {
                if (mediaQueryList.removeListener) {
                    mediaQueryList.removeListener(listener);
                } else {
                    mediaQueryList.removeEventListener('change', listener);
                }
            };
        }
    }, []);

    const handleLogin = (userData) => {
        setIsAuthenticated(true);
        setCurrentUser({
            email: userData.email,
            name: userData.name || userData.email.split('@')[0],
            phone: userData.phone || '+91 98765 43210',
            role: userData.role
        });
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        setActiveTab('dashboard');
    };

    const handleHistory = () => {
        setActiveTab('history');
        setProfileVisible(false); // Close the popup
    };

    const handleCollect = async (shipmentId, notes, photos) => {
        console.log('Initiating collection for:', shipmentId);
        lockOrder(shipmentId);
        try {
            const response = await fetch(`${BACKEND_URL}/api/orders/${shipmentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'collected',
                    collectionNotes: notes,
                    collectionPhotos: photos
                })

            });

            if (response.ok) {
                console.log('Collection successful on backend');
                const shipment = shipments.find(s => s.id === shipmentId);
                setShipments(prev => prev.map(s =>
                    s.id === shipmentId
                        ? { ...s, status: 'collected', collectionDate: new Date().toLocaleString(), collectionNotes: notes, collectionPhotos: photos }
                        : s
                ));
                if (shipment) logActivity('Collection', `Order #${shipment.orderId} collected`, Package, '#8B5CF6');
                showAlert("Success", "Shipment collected!");
                setActiveTab('labeling');
                return true;
            } else {
                console.error('Collection failed on backend:', response.status);
                const errorData = await response.json().catch(() => ({}));
                showAlert("Error", `Server responded with ${response.status}: ${errorData.message || 'Unknown error'}`);
                return false;
            }
        } catch (error) {
            console.error('Error collecting shipment:', error);
            showAlert("Error", "Network error while updating collection");
            return false;
        }
    };

    const handleLabel = async (shipmentId, packageInfo) => {
        lockOrder(shipmentId);
        try {
            const { moveToDistribution, moveToTransit, deliveryInfo, suppressAlert, ...finalPackageInfo } = packageInfo;

            // Determine target status: if deliveryInfo is present, we go straight to 'ready-for-delivery'
            // Otherwise, we go to 'packaged' (which puts it in Distribution Ready list)
            const newStatus = (deliveryInfo && deliveryInfo.driverId) ? 'ready-for-delivery' : 'packaged';

            const payload = {
                status: newStatus,
                packageInfo: JSON.stringify(finalPackageInfo)
            };

            if (deliveryInfo) {
                payload.deliveryInfo = JSON.stringify({
                    ...deliveryInfo,
                    assignedDate: new Date()
                });
            } else {
                // Explicitly clear delivery info if not provided (e.g. re-labeling or fresh label)
                // This ensures Distribution view shows 'Assign' options instead of stale delivery data.
                payload.deliveryInfo = null;
            }

            const response = await fetch(`${BACKEND_URL}/api/orders/${shipmentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const shipment = shipments.find(s => s.id === shipmentId);
                setShipments(prev => prev.map(s =>
                    s.id === shipmentId ? {
                        ...s,
                        status: newStatus,
                        packageInfo: finalPackageInfo,
                        ...(deliveryInfo ? { deliveryInfo } : {})
                    } : s
                ));

                if (shipment) {
                    if (newStatus === 'ready-for-delivery') {
                        logActivity('Dispatch', `Order #${shipment.orderId} labeled & dispatched`, Navigation, '#14B8A6');
                    } else {
                        logActivity('Labeling', `Label generated for Order #${shipment.orderId}`, QrCode, '#EC4899');
                    }
                }

                if (!suppressAlert) {
                    showAlert("Success", newStatus === 'ready-for-delivery' ? "Shipment dispatched!" : "Label generated!");
                }

                if (moveToTransit) {
                    setActiveTab('transit');
                } else if (moveToDistribution) {
                    setActiveTab('distribution');
                }
                // If both are false, stay on current tab (labeling) to allow bulk processing
            } else {
                const errorData = await response.json().catch(() => ({}));
                showAlert("Error", `Label failed (${response.status}): ${errorData.message || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error labeling shipment:', error);
            showAlert("Error", "Network error while updating labeling");
        }
    };

    const handleAssignDelivery = async (shipmentId, deliveryDetails) => {
        lockOrder(shipmentId);
        try {
            const response = await fetch(`${BACKEND_URL}/api/orders/${shipmentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'ready-for-delivery',
                    deliveryInfo: JSON.stringify({
                        ...deliveryDetails,
                        assignedDate: new Date()
                    })
                })
            });

            if (response.ok) {
                const shipment = shipments.find(s => s.id === shipmentId);
                setShipments(prev => prev.map(s =>
                    s.id === shipmentId ? {
                        ...s,
                        status: 'ready-for-delivery',
                        deliveryInfo: deliveryDetails
                    } : s
                ));
                const assigneeName = deliveryDetails.driver || deliveryDetails.partnerName || deliveryDetails.agencyName || 'driver/partner';
                if (shipment) logActivity('Dispatch', `Order #${shipment.orderId} assigned to ${assigneeName}`, Navigation, '#10B981');
                showAlert("Success", `Shipment assigned to ${deliveryDetails.deliveryType === 'own-delivery' ? 'driver' : 'partner'}!`);
                setActiveTab('transit');
            } else {
                const errorData = await response.json().catch(() => ({}));
                showAlert("Error", `Dispatch failed (${response.status}): ${errorData.message || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error assigning delivery:', error);
            showAlert("Error", "Network error while updating delivery assignment");
        }
    };

    const handleScheduleReturn = async (returnId, boy, mode = 'driver') => {
        try {
            const payload = {
                status: 'PickedUp'
            };

            if (mode === 'driver') {
                payload.driverId = boy.id;
                payload.driverName = boy.name;
            } else {
                payload.distributorId = boy.id;
                payload.distributorName = boy.name;
            }

            const response = await fetch(`${BACKEND_URL}/api/returns/${returnId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                setReturnShipments(prev => prev.map(r =>
                    r.id === returnId ? {
                        ...r,
                        returnInfo: {
                            ...r.returnInfo,
                            status: 'assigned',
                            driverName: mode === 'driver' ? boy.name : null,
                            distributorName: mode === 'distributor' ? boy.name : null
                        }
                    } : r
                ));
                logActivity('Return', `Pickup assigned to ${boy.name}`, RotateCcw, '#EF4444');
                showAlert("Success", `${mode === 'driver' ? 'Driver' : 'Distributor'} assigned for pickup!`);
            } else {
                showAlert("Error", "Failed to assign driver for return");
            }
        } catch (error) {
            console.error('Error scheduling return:', error);
            showAlert("Error", "Network error while scheduling return");
        }
    };

    const handleConfirmHubDelivery = async (returnId) => {
        try {
            const response = await fetch(`${BACKEND_URL}/api/returns/confirm-hub`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: returnId,
                    exchangeImage: null
                })
            });

            if (response.ok) {
                setReturnShipments(prev => prev.map(r =>
                    r.id === returnId ? {
                        ...r,
                        returnInfo: { ...r.returnInfo, isHubConfirmed: true }
                    } : r
                ));
                logActivity('Return', `Return arrival confirmed at Hub`, CheckCircle, '#10B981');
                showAlert("Success", "Return arrival confirmed at hub!");
            } else {
                showAlert("Error", "Failed to confirm hub delivery");
            }
        } catch (error) {
            console.error('Error confirming hub delivery:', error);
            showAlert("Error", "Network error while confirming hub delivery");
        }
    };

    const handleConfirmHubExchange = async (returnId, exchangeImage) => {
        try {
            const response = await fetch(`${BACKEND_URL}/api/returns/confirm-hub`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: returnId,
                    exchangeImage: exchangeImage
                })
            });

            if (response.ok) {
                setReturnShipments(prev => prev.map(r =>
                    r.id === returnId ? {
                        ...r,
                        returnInfo: { ...r.returnInfo, isHubConfirmed: true, exchangeImage: exchangeImage }
                    } : r
                ));
                logActivity('Return', `Return exchange confirmed at Hub`, CheckCircle, '#10B981');
                showAlert("Success", "Exchange item confirmed at hub!");
            } else {
                showAlert("Error", "Failed to confirm exchange hub arrival");
            }
        } catch (error) {
            console.error('Error confirming hub exchange:', error);
            showAlert("Error", "Neutral error during hub confirmation");
        }
    };

    const handleDownloadReturnReport = async (ids) => {
        try {
            const response = await fetch(`${BACKEND_URL}/api/returns/mark-downloaded`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids })
            });

            if (response.ok) {
                setReturnShipments(prev => prev.map(r => {
                    const isMatched = ids.includes(r.id) ||
                        ids.includes(r.orderId) ||
                        (r.returnId && ids.includes(r.returnId));
                    return isMatched ? {
                        ...r,
                        returnInfo: { ...r.returnInfo, isDownloaded: true }
                    } : r;
                }));
            } else {
                console.error('Failed to mark returns as downloaded in DB');
            }
        } catch (error) {
            console.error('Error marking returns as downloaded:', error);
        }
    };

    const handleDownloadCompletedReturnReport = async (ids) => {
        try {
            const response = await fetch(`${BACKEND_URL}/api/returns/mark-completed-downloaded`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids })
            });

            if (response.ok) {
                setReturnShipments(prev => prev.map(r => {
                    const isMatched = ids.includes(r.id) ||
                        ids.includes(r.orderId) ||
                        (r.returnId && ids.includes(r.returnId));
                    return isMatched ? {
                        ...r,
                        returnInfo: { ...r.returnInfo, isCompletedDownloaded: true }
                    } : r;
                }));
            } else {
                console.error('Failed to mark returns as completed-downloaded in DB');
            }
        } catch (error) {
            console.error('Error marking returns as completed-downloaded:', error);
        }
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard': return <ShipmentDashboard shipments={shipments} activities={activities} downloadedSlots={downloadedSlots} />;
            case 'collection': return <ShipmentCollection shipments={shipments} onCollect={handleCollect} downloadedSlots={downloadedSlots} onMarkAsDownloaded={handleMarkAsDownloaded} />;
            case 'labeling': return <PackageLabeling shipments={shipments} deliveryBoys={deliveryBoys} onLabel={handleLabel} />;
            case 'distribution': return <DistributionReady shipments={shipments} onAssignDelivery={handleAssignDelivery} />;
            case 'transit': return <TransitDelivery shipments={shipments} deliveryBoys={deliveryBoys} distributors={distributors} />;
            case 'returns':
                // Backend now handles merging failed transit orders into /api/returns
                const allReturns = [...returnShipments];

                return <ReturnManagement
                    shipments={allReturns.length > 0 ? allReturns : []}
                    deliveryBoys={deliveryBoys}
                    distributors={distributors}
                    onSchedulePickup={handleScheduleReturn}
                    onConfirmHubDelivery={handleConfirmHubDelivery}
                    onConfirmHubExchange={handleConfirmHubExchange}
                    onDownloadReport={handleDownloadReturnReport}
                    onDownloadCompletedReport={handleDownloadCompletedReturnReport}
                />;
            case 'delivery-boys': return <DeliveryBoyManagement
                deliveryBoys={deliveryBoys}
                onUpdateDeliveryBoys={setDeliveryBoys}
                distributors={distributors}
                onUpdateDistributors={setDistributors}
            />;
            case 'cash-details': return <CashCollection />;
            case 'history': return <DeliveryHistory shipments={shipments} returnShipments={returnShipments} />;

            default: return <ShipmentDashboard shipments={shipments} />;
        }
    };

    if (!isAuthenticated) {
        return (
            <SafeAreaProvider>
                <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }}>
                    <StatusBar barStyle="light-content" />
                    <LoginPage onLogin={handleLogin} />
                </SafeAreaView>
            </SafeAreaProvider>
        );
    }

    return (
        <SafeAreaProvider>
            <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }}>
                <StatusBar barStyle="light-content" />

                {/* Web Print Styles - CSS is instant, ensures elements are hidden before print dialog renders */}
                {Platform.OS === 'web' && (
                    <Text style={{ display: 'none' }}>
                        <style type="text/css">{`
                            @media print {
                                #app-header, #nav-tabs, [data-testid="no-print"] { display: none !important; }
                                html, body { height: auto !important; overflow: visible !important; }
                                #main-scroll { overflow: visible !important; height: auto !important; flex: none !important; display: block !important; }
                            }
                        `}</style>
                    </Text>
                )}

                {/* Header */}
                <LinearGradient
                    colors={['#774FC3', '#B94283']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    nativeID="app-header"
                    style={{ paddingHorizontal: 24, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#EC4899', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 12 }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Image
                            source={LogoSource}
                            style={{ width: 100, height: 100, borderRadius: 16 }}
                            resizeMode="contain"
                        />
                        <View>
                            <Text style={{ fontSize: 24, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5 }}>JKD MART</Text>
                            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '600' }}>HUB MANAGEMENT OS</Text>
                        </View>
                    </View>
                    <TouchableOpacity onPress={() => setProfileVisible(true)} style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}>
                        <User size={22} color="#FFFFFF" />
                    </TouchableOpacity>
                </LinearGradient>

                {/* Navigation Tabs */}
                <View nativeID="nav-tabs" style={{ marginTop: 16, zIndex: 10, paddingHorizontal: 12 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        {[
                            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
                            { 
                                id: 'collection', 
                                icon: Package, 
                                label: 'Collection',
                                badgeCount: unreadCollectionCount
                            },
                            { id: 'labeling', icon: QrCode, label: 'Labeling' },
                            { id: 'distribution', icon: Truck, label: 'Distribution' },
                            { id: 'transit', icon: Navigation, label: 'Transit' },
                            { 
                                id: 'returns', 
                                icon: RotateCcw, 
                                label: 'Returns',
                                badgeCount: unreadReturnsCount
                            },
                            { id: 'delivery-boys', icon: User, label: 'Fleet' },
                            { id: 'cash-details', icon: IndianRupee, label: 'Cash' },

                        ].map(tab => (
                            <TouchableOpacity
                                key={tab.id}
                                onPress={() => setActiveTab(tab.id)}
                                style={{
                                    flex: 1,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    paddingVertical: 12,
                                    borderRadius: 12,
                                    backgroundColor: activeTab === tab.id ? '#FFFFFF' : '#1e293b',
                                    shadowColor: activeTab === tab.id ? '#000' : 'transparent',
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: 0.1,
                                    shadowRadius: 8,
                                    elevation: activeTab === tab.id ? 4 : 0,
                                    position: 'relative'
                                }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                                    <tab.icon size={16} color={activeTab === tab.id ? '#EC4899' : '#FFFFFF'} />
                                    <Text numberOfLines={1} style={{ color: activeTab === tab.id ? '#0f172a' : '#FFFFFF', marginLeft: 6, fontSize: 12, fontWeight: '800' }}>{tab.label}</Text>
                                </View>
                                {tab.badgeCount > 0 && (
                                    <View style={{
                                        position: 'absolute',
                                        top: 2,
                                        right: 4,
                                        backgroundColor: '#EF4444',
                                        borderRadius: 8,
                                        minWidth: 16,
                                        height: 16,
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        paddingHorizontal: 3,
                                        borderWidth: 1.5,
                                        borderColor: activeTab === tab.id ? '#FFFFFF' : '#1e293b',
                                        zIndex: 20
                                    }}>
                                        <Text style={{ color: '#FFFFFF', fontSize: 8, fontWeight: '900', textAlign: 'center' }}>{tab.badgeCount}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Main Content Area */}
                <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 20 }}>
                    {renderContent()}
                </View>

                <ProfilePopup
                    user={currentUser}
                    visible={profileVisible}
                    onClose={() => setProfileVisible(false)}
                    onLogout={handleLogout}
                    onHistory={handleHistory}
                />

                {/* Real-time floating Toast Notification */}
                {toastMessage && (
                    <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => {
                            if (toastType === 'order') {
                                setActiveTab('collection');
                            } else {
                                setActiveTab('returns');
                            }
                            setToastMessage(null);
                        }}
                        style={{
                            position: 'absolute',
                            bottom: 24,
                            right: 24,
                            zIndex: 9999,
                            backgroundColor: 'rgba(30, 41, 59, 0.95)',
                            borderWidth: 1.5,
                            borderColor: toastType === 'order' ? '#EC4899' : '#EF4444',
                            borderRadius: 16,
                            paddingVertical: 14,
                            paddingHorizontal: 20,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 12,
                            shadowColor: toastType === 'order' ? '#EC4899' : '#EF4444',
                            shadowOffset: { width: 0, height: 8 },
                            shadowOpacity: 0.35,
                            shadowRadius: 16,
                            elevation: 10,
                        }}
                    >
                        <View style={{
                            width: 36,
                            height: 36,
                            borderRadius: 12,
                            backgroundColor: toastType === 'order' ? 'rgba(236, 72, 153, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            justifyContent: 'center',
                            alignItems: 'center'
                        }}>
                            {toastType === 'order' ? (
                                <Package size={18} color="#EC4899" />
                            ) : (
                                <RotateCcw size={18} color="#EF4444" />
                            )}
                        </View>
                        <View style={{ marginRight: 12 }}>
                            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>{toastMessage}</Text>
                            <Text style={{ color: '#94A3B8', fontSize: 11, marginTop: 2 }}>
                                Tap to view {toastType === 'order' ? 'collection' : 'returns'} list
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => setToastMessage(null)}
                            style={{
                                padding: 6,
                                borderRadius: 8,
                                backgroundColor: 'rgba(255, 255, 255, 0.05)'
                            }}
                        >
                            <X size={14} color="#94A3B8" />
                        </TouchableOpacity>
                    </TouchableOpacity>
                )}
            </SafeAreaView>
        </SafeAreaProvider>
    );
}
