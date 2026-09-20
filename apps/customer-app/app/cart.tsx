import { itemUnitPrice, lineKey, useCart } from "@/lib/cart";
import { PRIMARY_COLOR } from "@/lib/supabase";
import { router, Stack } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export default function CartScreen() {
  const cart = useCart();
  const items = cart.items;
  const subtotal = cart.getSubtotal();

  if (items.length === 0) {
    return (
      <>
        <Stack.Screen options={{ title: "Sacola" }} />
        <View style={styles.emptyCenter}>
          <Text style={styles.emptyEmoji}>🛍️</Text>
          <Text style={styles.emptyTitle}>Sua sacola está vazia</Text>
          <Text style={styles.emptyText}>Adicione itens do menu para fazer seu pedido.</Text>
          <Pressable onPress={() => router.replace("/")} style={styles.menuButton}>
            <Text style={styles.menuButtonText}>Ver menu</Text>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Sacola" }} />
      <SafeAreaView style={styles.screen} edges={["bottom"]}>
        <ScrollView contentContainerStyle={styles.content}>
          {items.map((item) => {
            const key = lineKey(item);
            return (
              <View key={key} style={styles.card}>
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={styles.image} />
                ) : (
                  <View style={[styles.image, styles.imagePlaceholder]} />
                )}
                <View style={styles.info}>
                  <Text style={styles.name}>{item.name}</Text>
                  {item.addons.length > 0 && (
                    <Text style={styles.addons} numberOfLines={2}>
                      + {item.addons.map((a) => a.name).join(", ")}
                    </Text>
                  )}
                  {item.observation ? (
                    <Text style={styles.observation} numberOfLines={2}>
                      Obs: {item.observation}
                    </Text>
                  ) : null}
                  <Text style={styles.price}>{money(itemUnitPrice(item))}</Text>
                </View>
                <View style={styles.right}>
                  <Pressable
                    onPress={() => cart.removeItem(key)}
                    style={styles.removeButton}
                    hitSlop={8}
                  >
                    <Text style={styles.removeText}>Remover</Text>
                  </Pressable>
                  <View style={styles.counter}>
                    <Pressable
                      onPress={() => cart.updateQuantity(key, item.quantity - 1)}
                      style={styles.counterButton}
                      hitSlop={6}
                    >
                      <Text style={styles.counterText}>−</Text>
                    </Pressable>
                    <Text style={styles.quantity}>{item.quantity}</Text>
                    <Pressable
                      onPress={() => cart.updateQuantity(key, item.quantity + 1)}
                      style={styles.counterButton}
                      hitSlop={6}
                    >
                      <Text style={styles.counterText}>+</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <Text style={styles.footerLabel}>Subtotal</Text>
            <Text style={styles.footerValue}>{money(subtotal)}</Text>
          </View>
          <Text style={styles.footerHint}>Taxa de entrega calculada no próximo passo.</Text>
          <Pressable onPress={() => router.push("/checkout")} style={styles.checkoutButton}>
            <Text style={styles.checkoutButtonText}>Finalizar pedido</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, paddingBottom: 24 },
  emptyCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    padding: 24,
  },
  emptyEmoji: { fontSize: 44, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  emptyText: { color: "#64748b", marginTop: 6, textAlign: "center" },
  menuButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 10,
    marginTop: 20,
  },
  menuButtonText: { color: "#fff", fontWeight: "800" },
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 10,
    marginBottom: 10,
  },
  image: { width: 64, height: 64, borderRadius: 10, backgroundColor: "#f1f5f9" },
  imagePlaceholder: { backgroundColor: "#f1f5f9" },
  info: { flex: 1, marginHorizontal: 10 },
  name: { fontWeight: "800", color: "#0f172a" },
  addons: { color: "#ea580c", fontSize: 11, marginTop: 2 },
  observation: { color: "#64748b", fontSize: 11, marginTop: 2, fontStyle: "italic" },
  price: { color: PRIMARY_COLOR, fontWeight: "800", marginTop: 5, fontSize: 13 },
  right: { alignItems: "flex-end", justifyContent: "space-between" },
  removeButton: { paddingHorizontal: 4, paddingVertical: 2 },
  removeText: { color: "#dc2626", fontSize: 11, fontWeight: "700" },
  counter: { flexDirection: "row", alignItems: "center", gap: 8 },
  counterButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  counterText: { fontSize: 17, fontWeight: "700", color: "#334155" },
  quantity: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
    minWidth: 18,
    textAlign: "center",
  },
  footer: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
  },
  footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerLabel: { color: "#334155", fontWeight: "800", fontSize: 15 },
  footerValue: { color: PRIMARY_COLOR, fontWeight: "800", fontSize: 17 },
  footerHint: { color: "#94a3b8", fontSize: 11, marginTop: 4 },
  checkoutButton: {
    backgroundColor: "#16a34a",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 12,
  },
  checkoutButtonText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
