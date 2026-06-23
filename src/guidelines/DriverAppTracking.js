
// Use this snippet in your Driver App (React Native with Expo)

import io from 'socket.io-client';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

// Initialize Socket
const socket = io('http://YOUR_BACKEND_IP:5000');

export default function useDriverTracking(orderId) {
    const [location, setLocation] = useState(null);

    useEffect(() => {
        let subscription = null;

        const startTracking = async () => {
            // 1. Request Permissions
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                console.error('Permission to access location was denied');
                return;
            }

            // 2. Start Watching Position
            subscription = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.High,
                    timeInterval: 5000, // Update every 5 seconds
                    distanceInterval: 10, // Or every 10 meters
                },
                (loc) => {
                    const { latitude, longitude } = loc.coords;
                    setLocation({ latitude, longitude });

                    // 3. Emit to Backend
                    console.log('Sending location:', latitude, longitude);
                    socket.emit('update_location', {
                        orderId: orderId, // The Order ID assigned to this driver
                        latitude,
                        longitude,
                        status: 'En Route'
                    });
                }
            );
        };

        if (orderId) {
            startTracking();
        }

        return () => {
            if (subscription) {
                subscription.remove();
            }
        };
    }, [orderId]);

    return location;
}
