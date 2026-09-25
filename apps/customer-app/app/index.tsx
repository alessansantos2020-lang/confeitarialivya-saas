import { fetchCatalog, fetchStore, type CatalogCategory, type StoreSettings } from "@/lib/api";
import { PRIMARY_COLOR, SECONDARY_COLOR, STORE_SLUG } from "@/lib/supabase";
import { useCart } from "@/lib/cart";
import { useQuery } from "@tanstack/react-query";
import { Link, router, Stack } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export default function StoreScreen() {
  const cart = useCart();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<CatalogCategory>>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const storeQuery = useQuery({ queryKey: ["store", STORE_SLUG], queryFn: fetchStore });
  const catalogQuery = useQuery({ queryKey: ["catalog"], queryFn: fetchCatalog });
  const store = storeQuery.data;
  const settings = store?.settings;
  const catalog = useMemo(
    () =>
      (catalogQuery.data ?? []).filter((category) =>
        category.products.some((product) => product.is_available !== false),
      ),
    [catalogQuery.data],
  );
  const allProducts = useMemo(
    () => catalog.flatMap((category) => category.products),
    [catalog],
  );
  const now = Date.now();
  const featuredProducts = useMemo(
    () =>
      allProducts
        .filter((product) => {
          if (product.is_featured !== true) return false;
          if (product.is_available === false) return false;
          if (product.featured_start_at && new Date(product.featured_start_at).getTime() > now) {
            return false;
          }
          if (product.featured_end_at && new Date(product.featured_end_at).getTime() <= now) {
            return false;
          }
          return true;
        })
        .sort(
          (first, second) =>
            (first.featured_sort_order ?? 0) - (second.featured_sort_order ?? 0) ||
            first.name.localeCompare(second.name),
        ),
    [allProducts, now],
  );
  const totalItems = cart.getTotalItems();
  const total = cart.getTotal();
  const isOpen = settings?.is_open !== false && store?.store.status === "active";

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

  const scrollToCategory = (categoryId: string) => {
    setActiveCategory(categoryId);
    const index = catalog.findIndex((category) => category.id === categoryId);
    if (index >= 0) {
      listRef.current?.scrollToIndex({ index, viewPosition: 0.02, animated: true });
    }
  };

  const categoryNavigation = (
    <View style={styles.categoryNavigation}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryNavigationContent}
        directionalLockEnabled
      >
        <Pressable
          onPress={() => {
            setActiveCategory(null);
            listRef.current?.scrollToOffset({ offset: 0, animated: true });
          }}
          style={[styles.categoryPill, activeCategory === null && styles.categoryPillActive]}
        >
          <Text
            style={[
              styles.categoryPillText,
              activeCategory === null && styles.categoryPillTextActive,
            ]}
          >
            Tudo
          </Text>
        </Pressable>
        {catalog.map((category) => (
          <Pressable
            key={category.id}
            onPress={() => scrollToCategory(category.id)}
            style={[
              styles.categoryPill,
              activeCategory === category.id && styles.categoryPillActive,
            ]}
          >
            <Text
              style={[
                styles.categoryPillText,
                activeCategory === category.id && styles.categoryPillTextActive,
              ]}
            >
              {category.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: settings.name }} />
      <View style={[styles.screen, { paddingBottom: 76 + insets.bottom }]}>
        <FlatList
          ref={listRef}
          data={catalog}
          keyExtractor={(category) => category.id}
          onScrollToIndexFailed={() => {}}
          contentContainerStyle={styles.listContent}
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
                <Text style={styles.menuHint}>Escolha seus produtos</Text>
              </View>
              {catalog.length > 0 ? categoryNavigation : null}
              {featuredProducts.length > 0 ? (
                <View style={styles.featuredSection}>
                  <Text style={styles.featuredSectionTitle}>
                    {settings.featured_section_title || "Em destaque"}
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.featuredList}
                  >
                    {featuredProducts.map((product) => {
                      const hasAddons = product.addons.some(
                        ({ group }) => group.status !== "inactive" && (group.items?.length ?? 0) > 0,
                      );
                      return (
                        <View key={`feat-${product.id}`} style={styles.featuredCardWrap}>
                          <Link href={`/product/${product.id}`} asChild>
                            <Pressable style={styles.featuredCard}>
                              {product.image_url ? (
                                <Image
                                  source={{ uri: product.image_url }}
                                  style={styles.featuredImage}
                                />
                              ) : (
                                <View
                                  style={[styles.featuredImage, { backgroundColor: "#f1f5f9" }]}
                                />
                              )}
                              {product.featured_badge ? (
                                <View style={styles.featuredBadge}>
                                  <Text style={styles.featuredBadgeText}>
                                    {product.featured_badge}
                                  </Text>
                                </View>
                              ) : null}
                              <View style={styles.featuredInfo}>
                                <Text style={styles.featuredName} numberOfLines={1}>
                                  {product.name}
                                </Text>
                                <View style={styles.featuredPriceRow}>
                                  <Text style={styles.featuredPrice}>
                                    {money(product.effective_price)}
                                  </Text>
                                  <Pressable
                                    accessibilityLabel={`Adicionar ${product.name} à sacola`}
                                    accessibilityRole="button"
                                    onPress={(e) => {
                                      e.stopPropagation();
                                      if (hasAddons) {
                                        router.push({
                                          pathname: `/product/${product.id}`,
                                          params: { quickAdd: "true" },
                                        });
                                        return;
                                      }
                                      cart.addItem({
                                        product_id: product.id,
                                        name: product.name,
                                        unit_price: product.effective_price,
                                        image_url: product.image_url,
                                        quantity: 1,
                                        observation: "",
                                        addon_ids: [],
                                        addons: [],
                                      });
                                      Alert.alert("Adicionado", `${product.name} foi adicionado à sacola.`);
                                    }}
                                    style={styles.featuredAddButton}
                                  >
                                    <Text style={styles.featuredAddText}>+</Text>
                                  </Pressable>
                                </View>
                              </View>
                            </Pressable>
                          </Link>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}
            </View>
          }
          ListFooterComponent={
            <View style={styles.storeFooter}>
              <Text style={styles.footerTitle}>Sobre a loja</Text>
              <View style={styles.footerStatusRow}>
                <View
                  style={[styles.statusDot, { backgroundColor: isOpen ? "#16a34a" : "#dc2626" }]}
                />
                <Text style={[styles.footerStatus, { color: isOpen ? "#15803d" : "#b91c1c" }]}>
                  {isOpen ? "Loja aberta agora" : "Loja fechada no momento"}
                </Text>
              </View>
              {settings.description ? (
                <Text style={styles.footerText}>{settings.description}</Text>
              ) : null}
              {settings.opening_hours ? (
                <Text style={styles.footerText}>🕒 {settings.opening_hours}</Text>
              ) : null}
              {settings.address ? (
                <Text style={styles.footerText}>📍 {settings.address}</Text>
              ) : null}
              {settings.phone ? <Text style={styles.footerText}>☎️ {settings.phone}</Text> : null}
              {settings.whatsapp ? (
                <Text style={styles.footerText}>WhatsApp: {settings.whatsapp}</Text>
              ) : null}
              {settings.instagram ? (
                <Text style={styles.footerText}>{settings.instagram}</Text>
              ) : null}
              <Text style={styles.footerCopyright}>Feito com carinho para você</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.categoryBlock}>
              <Text style={styles.categoryTitle}>{item.name}</Text>
              <Text style={styles.categoryCount}>
                {item.products.filter((product) => product.is_available !== false).length} itens
              </Text>
              {item.products
                .filter((product) => product.is_available !== false)
                .map((product) => (
                  <View key={product.id} style={styles.productRow}>
                    <Pressable
                      accessibilityLabel={`Adicionar ${product.name}`}
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => {
                        const hasAddons = product.addons.some(
                          ({ group }) => group.status !== "inactive" && (group.items?.length ?? 0) > 0,
                        );
                        if (hasAddons) {
                          router.push({
                            pathname: `/product/${product.id}`,
                            params: { quickAdd: "true" },
                          });
                          return;
                        }
                        cart.addItem({
                          product_id: product.id,
                          name: product.name,
                          unit_price: product.effective_price,
                          image_url: product.image_url,
                          quantity: 1,
                          observation: "",
                          addon_ids: [],
                          addons: [],
                        });
                        Alert.alert("Adicionado", `${product.name} foi adicionado à sacola.`);
                      }}
                      style={styles.addProductButton}
                    >
                      <Text style={styles.addProductText}>+</Text>
                    </Pressable>
                    <Link href={`/product/${product.id}`} asChild>
                      <Pressable style={styles.productCard}>
                        <View style={styles.productInfo}>
                          <Text style={styles.productName}>{product.name}</Text>
                          {product.description ? (
                            <Text style={styles.productDescription} numberOfLines={2}>
                              {product.description}
                            </Text>
                          ) : null}
                          <Text style={styles.productPrice}>{money(product.effective_price)}</Text>
                        </View>
                        {product.image_url ? (
                          <Image source={{ uri: product.image_url }} style={styles.productImage} />
                        ) : null}
                      </Pressable>
                    </Link>
                  </View>
                ))}
            </View>
          )}
        />

        <View style={[styles.cartButtonWrap, { bottom: insets.bottom + 14 }]}>
          <Link href="/cart" asChild>
            <Pressable
              accessibilityLabel={`Abrir sacola${totalItems > 0 ? ` com ${totalItems} item(ns)` : " vazia"}`}
              accessibilityRole="button"
              style={styles.cartButton}
            >
              <Text style={styles.cartIcon}>🛍️</Text>
              {totalItems > 0 ? <Text style={styles.cartBadge}>{totalItems}</Text> : null}
            </Pressable>
          </Link>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  errorText: { color: "#dc2626", fontSize: 16 },
  listContent: { paddingBottom: 20 },
  cover: {
    width: "100%",
    height: 190,
    resizeMode: "contain",
    backgroundColor: "#f1f5f9",
  },
  headerCard: {
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginTop: -28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 15,
    alignItems: "center",
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: "#fff",
    marginTop: -48,
    backgroundColor: "#f1f5f9",
  },
  storeName: { fontSize: 22, fontWeight: "800", color: "#0f172a", marginTop: 7 },
  menuHint: { color: "#64748b", fontSize: 12, marginTop: 4 },
  categoryNavigation: {
    backgroundColor: SECONDARY_COLOR,
    borderBottomWidth: 1,
    borderBottomColor: "#fed7aa",
    marginTop: 12,
  },
  categoryNavigationContent: { paddingHorizontal: 12, paddingVertical: 9, gap: 8 },
  featuredSection: { marginTop: 12, paddingHorizontal: 12 },
  featuredSectionTitle: { fontSize: 17, fontWeight: "800", color: "#0f172a", marginBottom: 8 },
  featuredList: { gap: 10, paddingVertical: 4 },
  featuredCardWrap: { width: 168 },
  featuredCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  featuredImage: { width: "100%", height: 104 },
  featuredBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  featuredBadgeText: { color: PRIMARY_COLOR, fontSize: 10, fontWeight: "800" },
  featuredInfo: { padding: 9 },
  featuredName: { fontWeight: "800", fontSize: 13, color: "#0f172a" },
  featuredPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 5,
  },
  featuredPrice: { color: PRIMARY_COLOR, fontWeight: "800", fontSize: 13 },
  featuredAddButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: PRIMARY_COLOR,
    alignItems: "center",
    justifyContent: "center",
  },
  featuredAddText: { color: "#fff", fontSize: 20, fontWeight: "400", lineHeight: 23 },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  categoryPillActive: { backgroundColor: PRIMARY_COLOR, borderColor: PRIMARY_COLOR },
  categoryPillText: { color: "#334155", fontWeight: "700", fontSize: 13 },
  categoryPillTextActive: { color: "#fff" },
  categoryBlock: { paddingHorizontal: 12, paddingTop: 18 },
  categoryTitle: { fontSize: 19, fontWeight: "800", color: "#0f172a" },
  categoryCount: { color: "#94a3b8", fontSize: 12, marginBottom: 8 },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  productCard: {
    flex: 1,
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
    padding: 10,
  },
  productInfo: { flex: 1 },
  productName: { fontWeight: "700", color: "#0f172a" },
  productDescription: { color: "#64748b", fontSize: 12, marginTop: 4 },
  productPrice: { color: PRIMARY_COLOR, fontWeight: "800", marginTop: 6 },
  productImage: {
    width: 88,
    height: 88,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    marginLeft: 10,
  },
  addProductButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: PRIMARY_COLOR,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0f172a",
    shadowOpacity: 0.2,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  addProductText: { color: "#fff", fontSize: 24, fontWeight: "400", lineHeight: 27 },
  storeFooter: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    marginTop: 18,
    padding: 22,
    alignItems: "center",
  },
  footerTitle: { color: "#0f172a", fontSize: 17, fontWeight: "800", marginBottom: 10 },
  footerStatusRow: { flexDirection: "row", alignItems: "center", marginBottom: 9 },
  statusDot: { width: 9, height: 9, borderRadius: 5, marginRight: 7 },
  footerStatus: { fontWeight: "800", fontSize: 13 },
  footerText: { color: "#64748b", textAlign: "center", fontSize: 12, marginTop: 6, lineHeight: 18 },
  footerCopyright: { color: "#94a3b8", fontSize: 10, marginTop: 18 },
  cartButtonWrap: {
    position: "absolute",
    right: 18,
    zIndex: 20,
    elevation: 20,
  },
  cartButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: PRIMARY_COLOR,
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0f172a",
    shadowOpacity: 0.32,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  cartIcon: { fontSize: 25 },

  cartBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    color: PRIMARY_COLOR,
    backgroundColor: "#fff",
    fontWeight: "800",
    fontSize: 11,
    minWidth: 20,
    textAlign: "center",
    borderRadius: 10,
    overflow: "hidden",
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
});
