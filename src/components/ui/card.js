import React from 'react';
import { View, Text } from 'react-native';

const cleanChildren = (children) => 
    React.Children.toArray(children).filter(c => typeof c !== 'string');

export const Card = ({ children, style }) => (
    <View style={[{ backgroundColor: '#1E293B', borderRadius: 12, borderWidth: 1, borderColor: '#334155', overflow: 'hidden' }, style]}>
        {cleanChildren(children)}
    </View>
);

export const CardHeader = ({ children, style }) => (
    <View style={[{ padding: 16 }, style]}>
        {cleanChildren(children)}
    </View>
);

export const CardTitle = ({ children, style }) => (
    <Text style={[{ fontSize: 20, fontWeight: 'bold', color: '#F8FAFC' }, style]}>{children}</Text>
);

export const CardDescription = ({ children, style }) => (
    <Text style={[{ fontSize: 14, color: '#94A3B8', marginTop: 4 }, style]}>{children}</Text>
);

export const CardContent = ({ children, style }) => (
    <View style={[{ padding: 16 }, style]}>
        {cleanChildren(children)}
    </View>
);
