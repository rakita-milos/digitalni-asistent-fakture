import { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export interface SelectOption {
  id: string;
  label: string;
  subtitle?: string;
}

interface SelectModalProps {
  visible: boolean;
  title: string;
  options: SelectOption[];
  onSelect: (id: string) => void;
  onClose: () => void;
  searchPlaceholder?: string;
  emptyLabel?: string;
}

/** Bottom-sheet birač (kupac, artikal) — bez native picker zavisnosti. */
export function SelectModal({
  visible,
  title,
  options,
  onSelect,
  onClose,
  searchPlaceholder = 'Traži…',
  emptyLabel = 'Nema rezultata.',
}: SelectModalProps) {
  const [query, setQuery] = useState('');
  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? options.filter((option) =>
        `${option.label} ${option.subtitle ?? ''}`.toLowerCase().includes(normalized),
      )
    : options;

  function handleClose(): void {
    setQuery('');
    onClose();
  }

  function handleSelect(id: string): void {
    setQuery('');
    onSelect(id);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={handleClose} testID="select-close">
              <Text style={styles.close}>Zatvori</Text>
            </Pressable>
          </View>

          <TextInput
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder={searchPlaceholder}
            autoCapitalize="none"
            autoCorrect={false}
            testID="select-search"
          />

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable style={styles.row} onPress={() => handleSelect(item.id)}>
                <Text style={styles.label}>{item.label}</Text>
                {item.subtitle ? <Text style={styles.subtitle}>{item.subtitle}</Text> : null}
              </Pressable>
            )}
            ListEmptyComponent={<Text style={styles.empty}>{emptyLabel}</Text>}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(17, 24, 39, 0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '75%',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#1F2937', fontSize: 17, fontWeight: '700' },
  close: { color: '#1D4ED8', fontSize: 14, fontWeight: '600', padding: 4 },
  search: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#1F2937',
    marginTop: 12,
    marginBottom: 8,
  },
  row: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingVertical: 12,
  },
  label: { color: '#1F2937', fontSize: 15, fontWeight: '600' },
  subtitle: { color: '#6B7280', fontSize: 12, marginTop: 2 },
  empty: { color: '#6B7280', textAlign: 'center', marginTop: 24 },
});
