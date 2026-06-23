import React from 'react';
import { View, Text } from 'react-native';

export function Badge({ children, variant = 'default', style }) {
    const getVariantStyle = () => {
        switch (variant) {
            case 'secondary': return { backgroundColor: '#334155' };
            case 'outline': return { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#334155' };
            case 'destructive': return { backgroundColor: '#EF4444' };
            default: return { backgroundColor: '#7C3AED' };
        }
    };

    const getTextColor = () => {
        if (variant === 'outline') return '#F8FAFC';
        return '#FFFFFF';
    };

    return (
        <View style={[{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' }, getVariantStyle(), style]}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: getTextColor(), textTransform: 'uppercase' }}>{children}</Text>
        </View>
    );
}
