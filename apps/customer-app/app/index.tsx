import { fetchCatalog, fetchStore, type CatalogCategory, type StoreSettings } from "@/lib/api";
import { PRIMARY_COLOR, SECONDARY_COLOR, STORE_SLUG } from "@/lib/supabase";
import { useCart } from "@/lib/cart";
import {
  pickFlashOffer,
  getFlashCountdown,
  wasFlashDismissed,
  dismissFlashOffer,
  type FlashOfferProduct,
} from "@/lib/flash-offer";
import { useQuery } from "@tanstack/react-query";
import { Link, router, Stack } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
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
  const totalItems = cart.getTotalItems();
  const total = cart.getTotal();
  const isOpen = settings?.is_open !== false && store?.store.status === "active";

  // ⚡ Oferta Relâmpago: abre automaticamente na 1ª visita da sessão.
  const allProducts = useMemo(
    () => (catalogQuery.data ?? []).flatMap((category) => category.products),
    [catalogQuery.data],
  );
  const flashOffer = useMemo(() => pickFlashOffer(allProducts), [allProducts]);
  const [flashOfferClosed, setFlashOfferClosed] = useState(false);
  const [countdown, setCountdown] = useState(() => getFlashCountdown(flashOffer?.sale_end_at));
  const showFlashOffer =
    !!flashOffer &&
    !flashOfferClosed &&
    !wasFlashDismissed(flashOffer.id, flashOffer.sale_start_at);

  useEffect(() => {
    setCountdown(getFlashCountdown(flashOffer?.sale_end_at));
    if (!showFlashOffer || !flashOffer?.sale_end_at) return;
    const timer = setInterval(() => setCountdown(getFlashCountdown(flashOffer.sale_end_at)), 1000);
    return () => clearInterval(timer);
  }, [flashOffer?.sale_end_at, showFlashOffer]);

  const closeFlashOffer = () => {
    setFlashOfferClosed(true);
    if (flashOffer) dismissFlashOffer(flashOffer.id, flashOffer.sale_start_at);
  };

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
                  <Link key={product.id} href={`/product/${product.id}`} asChild>
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
                ))}
            </View>
          )}
        />

        <View style={[styles.cartBarWrap, { paddingBottom: insets.bottom + 8 }]}>
          <Link href="/cart" asChild>
            <Pressable style={[styles.cartBar, totalItems === 0 && styles.cartBarEmpty]}>
              <View style={styles.cartIconBox}>
                <Text style={styles.cartIcon}>🛍️</Text>
                <Text style={styles.cartBadge}>{totalItems}</Text>
              </View>
              <Text style={styles.cartBarText}>
                {totalItems === 0 ? "SACOLA VAZIA" : "VER SACOLA"}
              </Text>
              <Text style={styles.cartBarText}>{money(total)}</Text>
            </Pressable>
          </Link>
        </View>

        {showFlashOffer && flashOffer && (
          <Modal transparent animationType="fade" visible onRequestClose={closeFlashOffer}>
            <View style={styles.flashOverlay}>
              <View style={styles.flashCard}>
                <Pressable onPress={closeFlashOffer} hitSlop={10} style={styles.flashClose}>
                  <Text style={styles.flashCloseText}>✕</Text>
                </Pressable>

                <View style={[styles.flashBanner, { backgroundColor: PRIMARY_COLOR }]}>
                  <Text style={styles.flashBannerText}>⚡ OFERTA RELÂMPAGO</Text>
                </View>

                {flashOffer.image_url ? (
                  <Image source={{ uri: flashOffer.image_url }} style={styles.flashImage} />
                ) : (
                  <View style={[styles.flashImage, styles.flashImagePlaceholder]}>
                    <Text style={{ fontSize: 40 }}>⚡</Text>
                  </View>
                )}

                <View style={styles.flashBody}>
                  <Text style={styles.flashHeadline} numberOfLines={2}>
                    {flashOffer.flash_headline?.trim() || flashOffer.name}
                  </Text>
                  {flashOffer.flash_message?.trim() || flashOffer.description ? (
                    <Text style={styles.flashMessage} numberOfLines={2}>
                      {flashOffer.flash_message?.trim() || flashOffer.description}
                    </Text>
                  ) : null}

                  <View style={styles.flashPricesRow}>
                    <Text style={styles.flashOldPrice}>{money(flashOffer.price)}</Text>
                    <Text style={[styles.flashNewPrice, { color: PRIMARY_COLOR }]}>
                      {money(flashOffer.sale_price ?? flashOffer.effective_price)}
                    </Text>
                  </View>

                  <View style={styles.flashTimerBox}>
                    <Text style={styles.flashTimerLabel}>⏱ TERMINA EM</Text>
                    <Text style={styles.flashTimer}>{countdown}</Text>
                  </View>

                  <Pressable
                    onPress={() => {
                      closeFlashOffer();
                      router.push(`/product/${flashOffer.id}`);
                    }}
                    style={[styles.flashCta, { backgroundColor: PRIMARY_COLOR }]}
                  >
                    <Text style={styles.flashCtaText}>PEDIR AGORA</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  errorText: { color: "#dc2626", fontSize: 16 },
  listContent: { paddingBottom: 20 },
  cover: { width: "100%", height: 148, resizeMode: "cover" },
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
  productCard: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 10,
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
  cartBarWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: "transparent",
  },
  cartBar: {
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  cartBarEmpty: { backgroundColor: "#64748b" },
  cartIconBox: { flexDirection: "row", alignItems: "center" },
  cartIcon: { fontSize: 18 },
  cartBadge: {
    color: PRIMARY_COLOR,
    backgroundColor: "#fff",
    fontWeight: "800",
    fontSize: 11,
    minWidth: 20,
    textAlign: "center",
    borderRadius: 10,
    overflow: "hidden",
    marginLeft: 5,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  cartBarText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  flashOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  flashCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  flashClose: {
    position: "absolute",
    top: 46,
    right: 12,
    zIndex: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  flashCloseText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  flashBanner: { alignItems: "center", paddingVertical: 9 },
  flashBannerText: { color: "#fff", fontWeight: "800", fontSize: 12, letterSpacing: 1.2 },
  flashImage: { width: "100%", height: 190, resizeMode: "cover" },
  flashImagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
  },
  flashBody: { padding: 18, alignItems: "center" },
  flashHeadline: { fontSize: 19, fontWeight: "800", color: "#0f172a", textAlign: "center" },
  flashMessage: { color: "#64748b", fontSize: 12, marginTop: 4, textAlign: "center" },
  flashPricesRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  flashOldPrice: { color: "#94a3b8", textDecorationLine: "line-through", fontSize: 14 },
  flashNewPrice: { fontSize: 26, fontWeight: "800" },
  flashTimerBox: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginTop: 12,
    alignSelf: "center",
  },
  flashTimerLabel: { color: "#64748b", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  flashTimer: { fontSize: 22, fontWeight: "800", color: "#0f172a", fontVariant: ["tabular-nums"] },
  flashCta: {
    marginTop: 14,
    alignSelf: "stretch",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  flashCtaText: { color: "#fff", fontWeight: "800", fontSize: 15, letterSpacing: 0.5 },
});
