import React from 'react';
import { Text } from 'react-native';

export function Label({ children, style }) {
    return (
        <Text style={[{ fontSize: 14, fontWeight: '700', color: '#94A3B8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }, style]}>
            {children}
        </Text>
    );
}
