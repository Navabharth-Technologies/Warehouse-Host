import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';

export const Button = ({ onPress, title, variant = 'primary', loading = false, style, textStyle, children, ...props }) => {
    const isPrimary = variant === 'primary';
    const isOutline = variant === 'outline';
    const isGhost = variant === 'ghost';

    const getBaseStyle = () => ({
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        ...(isPrimary && { backgroundColor: '#7C3AED' }),
        ...(isOutline && { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#7C3AED' }),
        ...(isGhost && { backgroundColor: 'transparent' }),
    });

    const getTextStyle = () => ({
        fontSize: 16,
        fontWeight: '700',
        ...(isPrimary && { color: '#FFFFFF' }),
        ...(isOutline && { color: '#7C3AED' }),
        ...(isGhost && { color: '#7C3AED' }),
    });

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={loading}
            style={[getBaseStyle(), style]}
            activeOpacity={0.8}
            {...props}
        >
            {loading ? (
                <ActivityIndicator color={isPrimary ? '#fff' : '#7C3AED'} />
            ) : children ? (
                children
            ) : (
                <Text style={[getTextStyle(), textStyle]}>
                    {title}
                </Text>
            )}
        </TouchableOpacity>
    );
};
