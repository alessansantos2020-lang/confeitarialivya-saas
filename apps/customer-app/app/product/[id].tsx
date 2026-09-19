import { fetchCatalog, type CatalogProduct } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { PRIMARY_COLOR } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
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

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cart = useCart();
  const [quantity, setQuantity] = useState(1);
  const [observation, setObservation] = useState("");

  const catalogQuery = useQuery({ queryKey: ["catalog"], queryFn: fetchCatalog });
  const allProducts = (catalogQuery.data ?? []).flatMap((c) => c.products);
  const product: CatalogProduct | undefined = allProducts.find((p) => p.id === id);

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
        <Text style={{ color: "#dc2626" }}>Produto não encontrado.</Text>
      </View>
    );
  }

  const handleAddToCart = () => {
    cart.addItem({
      product_id: product.id,
      name: product.name,
      unit_price: product.effective_price,
      image_url: product.image_url,
      quantity,
      observation: observation.trim(),
      addon_ids: [],
      addon_names: [],
    });

    Alert.alert("Adicionado", `${quantity}x ${product.name} adicionado à sacola!`, [
      { text: "Ver sacola", onPress: () => router.push("/checkout") },
      { text: "Continuar comprando", onPress: () => router.back() },
    ]);
  };

  const total = product.effective_price * quantity;

  return (
    <>
      <Stack.Screen title={product.name} />
      <ScrollView contentContainerStyle={{ paddingBottom: 32, backgroundColor: "#fff" }}>
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} style={styles.heroImage} />
        ) : (
          <View style={[styles.heroImage, { backgroundColor: "#f1f5f9" }]} />
        )}

        <View style={{ padding: 16 }}>
          <Text style={styles.name}>{product.name}</Text>
          <Text style={styles.price}>
            R$ {product.effective_price.toFixed(2).replace(".", ",")}
          </Text>

          {product.description ? (
            <Text style={styles.description}>{product.description}</Text>
          ) : null}

          <Text style={styles.label}>Observações para este item</Text>
          <TextInput
            placeholder="Ex: caprichar no feijão, sem salada..."
            value={observation}
            onChangeText={setObservation}
            multiline
            numberOfLines={3}
            style={styles.observationInput}
          />

          <View style={styles.quantityRow}>
            <Text style={{ fontWeight: "700", color: "#0f172a" }}>Quantidade</Text>
            <View style={styles.counter}>
              <Pressable
                onPress={() => setQuantity(Math.max(1, quantity - 1))}
                style={styles.counterButton}
              >
                <Text style={styles.counterText}>−</Text>
              </Pressable>
              <Text style={styles.quantityDisplay}>{quantity}</Text>
              <Pressable
                onPress={() => setQuantity(quantity + 1)}
                style={styles.counterButton}
              >
                <Text style={styles.counterText}>+</Text>
              </Pressable>
            </View>
          </View>

          <Pressable onPress={handleAddToCart} style={styles.addButton}>
            <Text style={styles.addButtonText}>
              ADICIONAR À SACOLA · R$ {total.toFixed(2).replace(".", ",")}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  heroImage: { width: "100%", height: 220, resizeMode: "cover" },
  name: { fontSize: 22, fontWeight: "800", color: "#0f172a" },
  price: { fontSize: 20, fontWeight: "800", color: PRIMARY_COLOR, marginTop: 4 },
  description: { color: "#475569", marginTop: 12, lineHeight: 20 },
  label: { fontWeight: "700", color: "#0f172a", marginTop: 20, marginBottom: 6 },
  observationInput: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 10,
    height: 70,
    textAlignVertical: "top",
  },
  quantityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 20,
  },
  counter: { flexDirection: "row", alignItems: "center", gap: 12 },
  counterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  counterText: { fontSize: 20, fontWeight: "700", color: "#334155" },
  quantityDisplay: { fontSize: 16, fontWeight: "700", color: "#0f172a", minWidth: 20, textAlign: "center" },
  addButton: {
    backgroundColor: PRIMARY_COLOR,
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  addButtonText: { color: "#fff", fontWeight: "800", fontSize: 14 },
});
