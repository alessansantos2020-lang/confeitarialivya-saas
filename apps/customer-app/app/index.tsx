import { fetchCatalog, fetchDeliveryFees, fetchPaymentMethods, fetchStore, type CatalogCategory, type DeliveryFee, type PaymentMethods, type StoreSettings } from "@/lib/api";
import { PRIMARY_COLOR, SECONDARY_COLOR, STORE_SLUG } from "@/lib/supabase";
import { useCart } from "@/lib/cart";
import { useQuery } from "@tanstack/react-query";
import { Link, Stack } from "expo-router";
import { ActivityIndicator, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMemo } from "react";

type StoreData = { store: { id: string; name: string; status: string }; settings: StoreSettings };

export default function StoreScreen() {
  const cart = useCart();

  const storeQuery = useQuery({ queryKey: ["store", STORE_SLUG], queryFn: fetchStore });
  const catalogQuery = useQuery({ queryKey: ["catalog"], queryFn: fetchCatalog });
  const feesQuery = useQuery({ queryKey: ["fees"], queryFn: fetchDeliveryFees });
  const methodsQuery = useQuery({ queryKey: ["methods"], queryFn: fetchPaymentMethods });

  const store = storeQuery.data;
  const settings = store?.settings;
  const catalog: CatalogCategory[] = catalogQuery.data ?? [];
  const methods: PaymentMethods | null = methodsQuery.data ?? null;

  const totalItems = cart.items.reduce((sum, i) => sum + i.quantity, 0);
  const total = cart.getTotal();

  if (storeQuery.isLoading || catalogQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
      </View>
    );
  }

  if (!store || !settings) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Loja não encontrada.</Text>
      </View>
    );
  }

  const isOpen = settings.is_open !== false && store.status === "active";

  return (
    <>
      <Stack.Screen title={store.name} />
      <View style={{ flex: 1, backgroundColor: "#fff" }}>
        <FlatList
          data={catalog}
          keyExtractor={(c) => c.id}
          ListHeaderComponent={
            <View>
              {settings.cover_url ? (
                <Image source={{ uri: settings.cover_url }} style={styles.cover} />
              ) : (
                <View style={[styles.cover, { backgroundColor: PRIMARY_COLOR }]} />
              )}
              <View style={styles.headerCard}>
                {settings.logo_url ? (
                  <Image source={{ uri: settings.logo_url }} style={styles.logo} />
                ) : null}
                <Text style={styles.storeName}>{settings.name}</Text>
                <Text style={[styles.badge, { color: isOpen ? "#16a34a" : "#dc2626" }]}>
                  {isOpen ? "ABERTO" : "FECHADO"}
                </Text>
                {settings.description ? (
                  <Text style={styles.description}>{settings.description}</Text>
                ) : null}
                {settings.opening_hours ? (
                  <Text style={styles.small}>{settings.opening_hours}</Text>
                ) : null}
                {settings.address ? <Text style={styles.small}>{settings.address}</Text> : null}
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.categoryBlock}>
              <Text style={styles.categoryTitle}>{item.name}</Text>
              {item.products.filter((p) => p.is_available !== false).map((product) => (
                <Link key={product.id} href={`/product/${product.id}`} asChild>
                  <Pressable style={styles.productCard}>
                    <View style={styles.productInfo}>
                      <Text style={styles.productName}>{product.name}</Text>
                      {product.description ? (
                        <Text style={styles.productDescription} numberOfLines={2}>
                          {product.description}
                        </Text>
                      ) : null}
                      <Text style={styles.productPrice}>
                        R$ {product.effective_price.toFixed(2).replace(".", ",")}
                      </Text>
                    </View>
                    {product.image_url ? (
                      <Image source={{ uri: product.image_url }} style={styles.productImage} />
                    ) : null}
                  </Pressable>
                </Link>
              ))}
            </View>
          )}
        />

        {totalItems > 0 && isOpen && (
          <Link href="/checkout" asChild>
            <Pressable style={styles.cartBar}>
              <Text style={styles.cartBarText}>
                VER SACOLA · {totalItems} {totalItems === 1 ? "item" : "itens"}
              </Text>
              <Text style={styles.cartBarText}>
                R$ {total.toFixed(2).replace(".", ",")}
              </Text>
            </Pressable>
          </Link>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  errorText: { color: "#dc2626", fontSize: 16 },
  cover: { width: "100%", height: 140 },
  headerCard: { alignItems: "center", padding: 16, marginTop: -40 },
  logo: { width: 80, height: 80, borderRadius: 16, borderWidth: 3, borderColor: "#fff" },
  storeName: { fontSize: 22, fontWeight: "800", marginTop: 8, color: "#0f172a" },
  badge: { fontWeight: "800", fontSize: 12, marginTop: 4 },
  description: { textAlign: "center", color: "#475569", marginTop: 6, paddingHorizontal: 16 },
  small: { color: "#94a3b8", fontSize: 12, marginTop: 4 },
  categoryBlock: { paddingHorizontal: 16, paddingBottom: 8 },
  categoryTitle: { fontSize: 18, fontWeight: "800", marginVertical: 12, color: "#0f172a" },
  productCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  productInfo: { flex: 1 },
  productName: { fontWeight: "700", color: "#0f172a" },
  productDescription: { color: "#64748b", fontSize: 12, marginTop: 4 },
  productPrice: { color: PRIMARY_COLOR, fontWeight: "800", marginTop: 6 },
  productImage: { width: 88, height: 88, borderRadius: 10, backgroundColor: "#f1f5f9" },
  cartBar: {
    backgroundColor: PRIMARY_COLOR,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cartBarText: { color: "#fff", fontWeight: "800" },
});

void SECONDARY_COLOR;
void feesQuery;
