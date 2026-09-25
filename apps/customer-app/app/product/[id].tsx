import { fetchCatalog, type AddonGroup, type CatalogProduct } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { PRIMARY_COLOR } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export default function ProductScreen() {
  const { id, quickAdd } = useLocalSearchParams<{ id: string; quickAdd?: string }>();
  const isQuickAdd = quickAdd === "true";
  const cart = useCart();
  const [quantity, setQuantity] = useState(1);
  const [observation, setObservation] = useState("");
  const [selectedAddons, setSelectedAddons] = useState<Record<string, string[]>>({});
  const catalogQuery = useQuery({ queryKey: ["catalog"], queryFn: fetchCatalog });

  const product = useMemo<CatalogProduct | null>(
    () =>
      catalogQuery.data?.flatMap((category) => category.products).find((item) => item.id === id) ??
      null,
    [catalogQuery.data, id],
  );

  const groups = useMemo<AddonGroup[]>(
    () =>
      (product?.addons ?? [])
        .map((entry) => entry.group)
        .filter((group) => group.status !== "inactive" && group.items.length > 0),
    [product],
  );

  const selectedAddonItems = groups.flatMap((group) =>
    (selectedAddons[group.id] ?? [])
      .map((itemId) => group.items.find((item) => item.id === itemId))
      .filter((item): item is { id: string; name: string; price: number } => Boolean(item)),
  );
  const unitPrice =
    (product?.effective_price ?? 0) + selectedAddonItems.reduce((sum, item) => sum + item.price, 0);

  const toggleAddon = (group: AddonGroup, itemId: string) => {
    setSelectedAddons((current) => {
      const selected = current[group.id] ?? [];
      if (selected.includes(itemId)) {
        return { ...current, [group.id]: selected.filter((id) => id !== itemId) };
      }
      if (group.max_quantity <= 1) return { ...current, [group.id]: [itemId] };
      if (selected.length >= group.max_quantity) {
        Alert.alert(
          "Limite atingido",
          `Escolha no máximo ${group.max_quantity} item(ns) em ${group.name}.`,
        );
        return current;
      }
      return { ...current, [group.id]: [...selected, itemId] };
    });
  };

  const handleAdd = () => {
    if (!product) return;
    const invalidGroup = groups.find(
      (group) => (selectedAddons[group.id] ?? []).length < group.min_quantity,
    );
    if (invalidGroup) {
      Alert.alert(
        "Escolha os adicionais",
        `Selecione pelo menos ${invalidGroup.min_quantity} item(ns) em “${invalidGroup.name}”.`,
      );
      return;
    }

    cart.addItem({
      product_id: product.id,
      name: product.name,
      unit_price: product.effective_price,
      image_url: product.image_url,
      quantity,
      observation: observation.trim(),
      addon_ids: selectedAddonItems.map((item) => item.id),
      addons: selectedAddonItems,
    });
    Alert.alert("Adicionado", `${quantity}x ${product.name} foi adicionado à sacola.`, [
      { text: "Continuar comprando", onPress: () => router.back() },
      { text: "Ver sacola", onPress: () => router.replace("/cart") },
    ]);
  };

  if (catalogQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
      </View>
    );
  }
  if (!product) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Produto não encontrado.</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: isQuickAdd ? "Adicionais" : product.name }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {!isQuickAdd && product.image_url ? (
          <Image source={{ uri: product.image_url }} style={styles.heroImage} />
        ) : null}
        <Text style={[styles.title, isQuickAdd && styles.quickTitle]}>{product.name}</Text>
        <Text style={styles.price}>{money(unitPrice)}</Text>
        {!isQuickAdd && product.description ? (
          <Text style={styles.description}>{product.description}</Text>
        ) : null}
        {isQuickAdd ? (
          <Text style={styles.quickHint}>Escolha os adicionais para continuar</Text>
        ) : null}

        {groups.map((group) => (
          <View key={group.id} style={styles.group}>
            <View style={styles.groupHeader}>
              <Text style={styles.groupTitle}>{group.name}</Text>
              <Text style={styles.groupHint}>
                {group.min_quantity > 0 ? `Obrigatório · mínimo ${group.min_quantity}` : "Opcional"}
              </Text>
            </View>
            {group.items.map((item) => {
              const selected = (selectedAddons[group.id] ?? []).includes(item.id);
              return (
                <Pressable
                  key={item.id}
                  onPress={() => toggleAddon(group, item.id)}
                  style={[
                    styles.addonRow,
                    selected && { borderColor: PRIMARY_COLOR, backgroundColor: "#fff7ed" },
                  ]}
                >
                  <View
                    style={[
                      styles.checkbox,
                      selected && { backgroundColor: PRIMARY_COLOR, borderColor: PRIMARY_COLOR },
                    ]}
                  >
                    {selected ? <Text style={styles.checkmark}>✓</Text> : null}
                  </View>
                  <Text style={styles.addonName}>{item.name}</Text>
                  <Text style={styles.addonPrice}>
                    {item.price > 0 ? `+ ${money(item.price)}` : "Grátis"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}

        <Text style={styles.label}>Observação</Text>
        <TextInput
          value={observation}
          onChangeText={setObservation}
          placeholder="Alguma observação para este produto?"
          multiline
          style={[styles.input, styles.textarea]}
        />

        <View style={styles.quantityRow}>
          <Text style={styles.label}>Quantidade</Text>
          <View style={styles.counter}>
            <Pressable
              onPress={() => setQuantity((value) => Math.max(1, value - 1))}
              style={styles.counterButton}
            >
              <Text style={styles.counterText}>−</Text>
            </Pressable>
            <Text style={styles.quantity}>{quantity}</Text>
            <Pressable
              onPress={() => setQuantity((value) => value + 1)}
              style={styles.counterButton}
            >
              <Text style={styles.counterText}>+</Text>
            </Pressable>
          </View>
        </View>

        <Pressable onPress={handleAdd} style={styles.addButton}>
          <Text style={styles.addButtonText}>
            Adicionar à sacola · {money(unitPrice * quantity)}
          </Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  content: { paddingBottom: 32 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  errorText: { color: "#dc2626", fontSize: 16 },
  heroImage: { width: "100%", height: 230, resizeMode: "cover" },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
    paddingHorizontal: 16,
    marginTop: 18,
  },
  quickTitle: {
    fontSize: 20,
    marginTop: 14,
  },
  quickHint: {
    color: PRIMARY_COLOR,
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 16,
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  price: {
    color: PRIMARY_COLOR,
    fontWeight: "800",
    fontSize: 18,
    paddingHorizontal: 16,
    marginTop: 6,
  },
  description: { color: "#64748b", lineHeight: 21, paddingHorizontal: 16, marginTop: 10 },
  group: { marginTop: 20, paddingHorizontal: 16 },
  groupHeader: { marginBottom: 8 },
  groupTitle: { fontSize: 17, fontWeight: "800", color: "#0f172a" },
  groupHint: { color: "#64748b", fontSize: 12, marginTop: 3 },
  addonRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  checkmark: { color: "#fff", fontWeight: "800" },
  addonName: { flex: 1, color: "#334155", fontWeight: "600" },
  addonPrice: { color: "#64748b", fontSize: 12 },
  label: { color: "#334155", fontWeight: "800", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: "#0f172a",
    backgroundColor: "#fff",
  },
  textarea: { minHeight: 78, textAlignVertical: "top", marginHorizontal: 16 },
  quantityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    margin: 16,
    marginTop: 22,
  },
  counter: { flexDirection: "row", alignItems: "center" },
  counterButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  counterText: { fontSize: 22, fontWeight: "700", color: "#334155" },
  quantity: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
    minWidth: 42,
    textAlign: "center",
  },
  addButton: {
    backgroundColor: PRIMARY_COLOR,
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginHorizontal: 16,
  },
  addButtonText: { color: "#fff", fontWeight: "800", fontSize: 14 },
});
