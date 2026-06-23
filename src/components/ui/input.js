import React from 'react';
import { TextInput, View, Text } from 'react-native';

export const Input = ({ label, placeholder, value, onChangeText, secureTextEntry, error, style, inputStyle, labelStyle, ...props }) => {
    const handleInputChange = (text) => {
        // Advanced emoji and special symbol filter
        // This regex removes emojis and keeps standard characters, numbers and basic punctuation
        const filtered = text.replace(/([\uE000-\uF8FF]|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDDFF]|\uD83D[\uDE00-\uDE4F]|\uD83D[\uDE80-\uDEFF]|\uD83E[\uDD00-\uDDFF])/g, '')
            .replace(/[^\w\s@.,;?!()#$%\-+=\n]/gi, '');

        if (onChangeText) {
            onChangeText(filtered);
        }
    };

    return (
        <View style={[{ marginBottom: 16, width: '100%' }, style]}>
            {!!label ? <Text style={[{ fontSize: 14, color: '#94A3B8', marginBottom: 6, fontWeight: '500' }, labelStyle]}>{label}</Text> : null}
            <TextInput
                style={[
                    { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: '#F1F5F9', fontSize: 16 },
                    error && { borderColor: '#EF4444' },
                    inputStyle
                ]}
                placeholder={placeholder}
                placeholderTextColor="#64748B"
                value={value}
                onChangeText={handleInputChange}
                secureTextEntry={secureTextEntry}
                {...props}
            />
            {!!error ? <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 4 }}>{error}</Text> : null}
        </View>
    );
};
