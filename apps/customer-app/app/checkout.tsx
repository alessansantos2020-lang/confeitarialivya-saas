import {
  createOrder,
  fetchDeliveryFees,
  fetchPaymentMethods,
  fetchStore,
  type DeliveryFee,
  type PaymentMethods,
  type StoreSettings,
} from "@/lib/api";
import { itemUnitPrice, useCart, type CartItem } from "@/lib/cart";
import { PRIMARY_COLOR } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { Linking } from "react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

function buildWhatsappMessage(
  settings: StoreSettings,
  orderId: string,
  items: CartItem[],
  neighborhood: string,
  deliveryFee: number,
  total: number,
  paymentMethod: "pix" | "money" | "card",
  changeFor: number | null,
  name: string,
  phone: string,
  address: string,
  observation: string,
): string {
  const itemLines = items
    .map((item) => {
      const addons = item.addons.length
        ? `\n   + Adicionais: ${item.addons.map((a) => a.name).join(", ")}`
        : "";
      const itemObservation = item.observation ? `\n   Obs: ${item.observation}` : "";
      return `* ${item.quantity}x ${item.name} - ${money(itemUnitPrice(item) * item.quantity)}${addons}${itemObservation}`;
    })
    .join("\n");
  const method =
    paymentMethod === "money"
      ? changeFor && changeFor > total
        ? `DINHEIRO (Troco para ${money(changeFor)} - Levar ${money(changeFor - total)})`
        : "DINHEIRO (Não precisa de troco)"
      : paymentMethod === "pix"
        ? "PIX"
        : "CARTÃO";

  return `*NOVO PEDIDO #${orderId}*\n\n*Cliente:* ${name}\n*WhatsApp:* ${phone}\n*Endereço:* ${address}\n*Bairro:* ${neighborhood}\n\n*Itens:*\n${itemLines}\n\n*Taxa de Entrega:* ${money(deliveryFee)}\n*Total:* ${money(total)}\n*Pagamento:* ${method}${observation ? `\n*Observação geral:* ${observation}` : ""}\n\n_Aguardando confirmação da loja._`;
}

type SuccessData = {
  orderId: string;
  items: CartItem[];
  neighborhood: string;
  deliveryFee: number;
  total: number;
  paymentMethod: "pix" | "money" | "card";
  changeFor: number | null;
  whatsapp: string | null;
  name: string;
  phone: string;
  address: string;
  observation: string;
};

export default function CheckoutScreen() {
  const cart = useCart();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [reference, setReference] = useState("");
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string | null>(
    cart.neighborhood,
  );
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "money" | "card">("pix");
  const [changeFor, setChangeFor] = useState("");
  const [observation, setObservation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<SuccessData | null>(null);

  const feesQuery = useQuery({ queryKey: ["fees"], queryFn: fetchDeliveryFees });
  const methodsQuery = useQuery({ queryKey: ["methods"], queryFn: fetchPaymentMethods });
  const storeQuery = useQuery({ queryKey: ["store"], queryFn: fetchStore });

  const fees: DeliveryFee[] = feesQuery.data ?? [];
  const methods: PaymentMethods | null = methodsQuery.data ?? null;
  const settings = storeQuery.data?.settings;
  const acceptCash = methods ? methods.accept_cash !== false : true;
  const acceptCard = methods
    ? methods.accept_card_delivery !== false || methods.online_card_available === true
    : true;
  const acceptPix = methods
    ? methods.accept_manual_pix !== false || methods.online_pix_available === true
    : true;
  const availableMethods = useMemo(
    () => [
      ...(acceptPix ? (["pix"] as const) : []),
      ...(acceptCash ? (["money"] as const) : []),
      ...(acceptCard ? (["card"] as const) : []),
    ],
    [acceptCard, acceptCash, acceptPix],
  );
  const currentFee = fees.find((fee) => fee.neighborhood === selectedNeighborhood)?.fee ?? 0;
  const subtotal = cart.getSubtotal();
  const total = subtotal + currentFee;

  useEffect(() => {
    if (selectedNeighborhood) {
      const fee = fees.find((item) => item.neighborhood === selectedNeighborhood)?.fee;
      if (fee !== undefined && cart.deliveryFee !== fee)
        cart.setDelivery(fee, selectedNeighborhood);
    }
  }, [cart, fees, selectedNeighborhood]);

  useEffect(() => {
    const fallback = availableMethods[0];
    if (fallback && !availableMethods.includes(paymentMethod)) {
      setPaymentMethod(fallback);
      setChangeFor("");
    }
  }, [availableMethods, paymentMethod]);

  const handleSubmit = async () => {
    if (
      !name.trim() ||
      !phone.trim() ||
      !street.trim() ||
      !number.trim() ||
      !selectedNeighborhood
    ) {
      Alert.alert("Atenção", "Preencha todos os campos obrigatórios.");
      return;
    }
    if (!availableMethods.includes(paymentMethod)) {
      Alert.alert("Pagamento indisponível", "Escolha uma forma de pagamento disponível.");
      return;
    }
    if (cart.items.length === 0) {
      Alert.alert("Atenção", "Sua sacola está vazia.");
      return;
    }

    let parsedChange: number | null = null;
    if (paymentMethod === "money" && changeFor.trim()) {
      const value = Number.parseFloat(changeFor.replace(",", "."));
      if (!Number.isNaN(value) && value > 0) {
        if (value < total) {
          Alert.alert(
            "Troco inválido",
            `O valor para troco não pode ser menor que ${money(total)}.`,
          );
          return;
        }
        parsedChange = value;
      }
    }

    const itemsSnapshot = cart.items.map((item) => ({
      ...item,
      addons: [...item.addons],
      addon_ids: [...item.addon_ids],
    }));
    const address = `${street.trim()}, ${number.trim()}${complement.trim() ? ` - ${complement.trim()}` : ""} - ${selectedNeighborhood}${reference.trim() ? ` (Ref: ${reference.trim()})` : ""}`;

    try {
      setIsSubmitting(true);
      const created = await createOrder({
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        address,
        neighborhood: selectedNeighborhood,
        street: street.trim(),
        number: number.trim(),
        complement: complement.trim() || null,
        reference: reference.trim() || null,
        payment_method: paymentMethod,
        change_for: parsedChange,
        observation: observation.trim() || null,
        items: itemsSnapshot.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          observation: item.observation || null,
          selected_addons: item.addon_ids.map((addonId) => ({ id: addonId })),
        })),
      });
      const order = created as { id?: string; total_amount?: number; delivery_fee?: number } | null;
      const orderId = order?.id?.slice(0, 8).toUpperCase() || "NOVO";
      const finalTotal = order?.total_amount ?? total;
      const finalFee = order?.delivery_fee ?? currentFee;
      cart.clearCart();
      setSuccess({
        orderId,
        items: itemsSnapshot,
        neighborhood: selectedNeighborhood,
        deliveryFee: finalFee,
        total: finalTotal,
        paymentMethod,
        changeFor: parsedChange,
        whatsapp: settings?.whatsapp ?? null,
        name: name.trim(),
        phone: phone.trim(),
        address,
        observation: observation.trim(),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Não foi possível enviar o pedido.";
      Alert.alert("Erro", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openWhatsapp = async () => {
    if (!success?.whatsapp) return;
    const text = buildWhatsappMessage(
      settings ?? {
        name: "",
        description: null,
        logo_url: null,
        cover_url: null,
        opening_hours: null,
        is_open: true,
        phone: null,
        whatsapp: null,
        instagram: null,
        address: null,
        primary_color: null,
        secondary_color: null,
      },
      success.orderId,
      success.items,
      success.neighborhood,
      success.deliveryFee,
      success.total,
      success.paymentMethod,
      success.changeFor,
      success.name,
      success.phone,
      success.address,
      success.observation,
    );
    const url = `https://wa.me/55${success.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("WhatsApp", "Não foi possível abrir o WhatsApp neste celular.");
    }
  };

  if (success) {
    return (
      <>
        <Stack.Screen options={{ title: "Pedido enviado" }} />
        <View style={styles.successScreen}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.successTitle}>Pedido enviado!</Text>
          <Text style={styles.successText}>
            Seu pedido #{success.orderId} foi recebido pela loja.
          </Text>
          <View style={styles.successBox}>
            <Text style={styles.successBoxTitle}>Total do pedido</Text>
            <Text style={styles.successTotal}>{money(success.total)}</Text>
            <Text style={styles.successSmall}>
              {success.items.reduce((sum, item) => sum + item.quantity, 0)} item(ns) ·{" "}
              {success.neighborhood}
            </Text>
          </View>
          {success.whatsapp ? (
            <Pressable onPress={openWhatsapp} style={styles.whatsappButton}>
              <Text style={styles.whatsappText}>Enviar pedido pelo WhatsApp</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => router.replace("/")} style={styles.continueButton}>
            <Text style={styles.continueText}>Voltar ao menu</Text>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Finalizar pedido" }} />
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.topRow}>
            <Text style={styles.section}>Sua sacola</Text>
            <Pressable onPress={() => router.push("/cart")}>
              <Text style={styles.editLink}>Editar sacola</Text>
            </Pressable>
          </View>
          <View style={styles.summaryBox}>
            {cart.items.map((item) => (
              <View
                key={`${item.product_id}-${item.addon_ids.join("-")}-${item.observation}`}
                style={styles.summaryRow}
              >
                <Text style={styles.summaryLabel}>
                  {item.quantity}x {item.name}
                </Text>
                <Text style={styles.summaryValue}>
                  {money(itemUnitPrice(item) * item.quantity)}
                </Text>
              </View>
            ))}
            <View style={[styles.summaryRow, { marginTop: 6 }]}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>{money(subtotal)}</Text>
            </View>
          </View>

          <Text style={styles.section}>Seus dados</Text>
          <TextInput
            placeholder="Nome completo *"
            value={name}
            onChangeText={setName}
            style={styles.input}
          />
          <TextInput
            placeholder="WhatsApp (com DDD) *"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            style={styles.input}
          />

          <Text style={styles.section}>Endereço de entrega</Text>
          <TextInput
            placeholder="Rua / Avenida *"
            value={street}
            onChangeText={setStreet}
            style={styles.input}
          />
          <View style={styles.inline}>
            <TextInput
              placeholder="Número *"
              value={number}
              onChangeText={setNumber}
              keyboardType="numeric"
              style={[styles.input, styles.numberInput]}
            />
            <TextInput
              placeholder="Complemento"
              value={complement}
              onChangeText={setComplement}
              style={[styles.input, styles.flexInput]}
            />
          </View>
          <TextInput
            placeholder="Ponto de referência"
            value={reference}
            onChangeText={setReference}
            style={styles.input}
          />
          <Text style={styles.fieldLabel}>Bairro *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            {fees.map((fee) => (
              <Pressable
                key={fee.neighborhood}
                onPress={() => setSelectedNeighborhood(fee.neighborhood)}
                style={[
                  styles.chip,
                  selectedNeighborhood === fee.neighborhood && styles.chipActive,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedNeighborhood === fee.neighborhood && styles.chipTextActive,
                  ]}
                >
                  {fee.neighborhood} · {money(fee.fee)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.section}>Forma de pagamento</Text>
          <View style={styles.paymentRow}>
            {acceptPix ? (
              <PaymentButton
                label="Pix"
                active={paymentMethod === "pix"}
                onPress={() => setPaymentMethod("pix")}
              />
            ) : null}
            {acceptCash ? (
              <PaymentButton
                label="Dinheiro"
                active={paymentMethod === "money"}
                onPress={() => setPaymentMethod("money")}
              />
            ) : null}
            {acceptCard ? (
              <PaymentButton
                label="Cartão"
                active={paymentMethod === "card"}
                onPress={() => setPaymentMethod("card")}
              />
            ) : null}
          </View>
          {paymentMethod === "money" ? (
            <View style={styles.changeBox}>
              <Text style={styles.changeTitle}>Precisa de troco?</Text>
              <View style={styles.paymentRow}>
                <PaymentButton
                  label="Não preciso"
                  active={!changeFor}
                  onPress={() => setChangeFor("")}
                  small
                />
                <PaymentButton
                  label="Sim, preciso"
                  active={Boolean(changeFor)}
                  onPress={() => setChangeFor(changeFor || String(Math.ceil(total / 10) * 10))}
                  small
                />
              </View>
              {changeFor ? (
                <TextInput
                  placeholder="Troco para quanto? Ex.: 50"
                  value={changeFor}
                  onChangeText={setChangeFor}
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
              ) : null}
              {changeFor && Number.parseFloat(changeFor.replace(",", ".")) >= total ? (
                <Text style={styles.changeResult}>
                  Levar {money(Number.parseFloat(changeFor.replace(",", ".")) - total)} de troco
                </Text>
              ) : null}
            </View>
          ) : null}

          <Text style={styles.section}>Observação do pedido</Text>
          <TextInput
            placeholder="Alguma observação geral?"
            value={observation}
            onChangeText={setObservation}
            multiline
            style={[styles.input, styles.textarea]}
          />
          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{money(total)}</Text>
          </View>
          <Pressable
            onPress={handleSubmit}
            disabled={isSubmitting || feesQuery.isLoading}
            style={[styles.submitButton, (isSubmitting || feesQuery.isLoading) && styles.disabled]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>Confirmar pedido</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

function PaymentButton({
  label,
  active,
  onPress,
  small = false,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  small?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.paymentButton,
        small && styles.paymentButtonSmall,
        active && styles.paymentButtonActive,
      ]}
    >
      <Text style={[styles.paymentButtonText, active && styles.paymentButtonTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16, paddingBottom: 34 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  section: { color: "#0f172a", fontSize: 17, fontWeight: "800", marginTop: 16, marginBottom: 10 },
  editLink: { color: PRIMARY_COLOR, fontWeight: "700", marginTop: 16 },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: "#0f172a",
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  inline: { flexDirection: "row", gap: 8 },
  numberInput: { width: 100 },
  flexInput: { flex: 1 },
  fieldLabel: { color: "#334155", fontWeight: "700", marginBottom: 7 },
  chipsScroll: { marginBottom: 4 },
  chip: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginRight: 8,
  },
  chipActive: { backgroundColor: PRIMARY_COLOR, borderColor: PRIMARY_COLOR },
  chipText: { color: "#475569", fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  paymentRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  paymentButton: {
    flex: 1,
    minWidth: 95,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 9,
    padding: 12,
    alignItems: "center",
  },
  paymentButtonSmall: { minWidth: 120, flex: 0 },
  paymentButtonActive: { backgroundColor: PRIMARY_COLOR, borderColor: PRIMARY_COLOR },
  paymentButtonText: { color: "#475569", fontWeight: "700", fontSize: 12 },
  paymentButtonTextActive: { color: "#fff" },
  changeBox: { backgroundColor: "#fff7ed", padding: 12, borderRadius: 9, marginTop: 10 },
  changeTitle: { color: "#9a3412", fontWeight: "800", marginBottom: 8 },
  changeResult: { color: "#15803d", fontWeight: "800", marginTop: 3 },
  summaryBox: { backgroundColor: "#f8fafc", borderRadius: 10, padding: 12 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  summaryLabel: { color: "#64748b", fontSize: 12, flex: 1 },
  summaryValue: { color: "#334155", fontSize: 12, fontWeight: "700" },
  textarea: { minHeight: 72, textAlignVertical: "top" },
  totalBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 18,
  },
  totalLabel: { color: "#0f172a", fontSize: 18, fontWeight: "800" },
  totalValue: { color: PRIMARY_COLOR, fontSize: 22, fontWeight: "800" },
  submitButton: { backgroundColor: "#16a34a", padding: 16, borderRadius: 10, alignItems: "center" },
  disabled: { opacity: 0.6 },
  submitText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  successScreen: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    padding: 24,
    paddingTop: 70,
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#dcfce7",
    color: "#16a34a",
    fontSize: 48,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 70,
  },
  successTitle: { color: "#0f172a", fontSize: 24, fontWeight: "800", marginTop: 20 },
  successText: { color: "#64748b", textAlign: "center", marginTop: 8 },
  successBox: {
    width: "100%",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 18,
    alignItems: "center",
    marginTop: 24,
    marginBottom: 18,
  },
  successBoxTitle: { color: "#64748b", fontSize: 12, fontWeight: "700" },
  successTotal: { color: PRIMARY_COLOR, fontSize: 26, fontWeight: "800", marginTop: 5 },
  successSmall: { color: "#64748b", fontSize: 12, marginTop: 5 },
  whatsappButton: {
    width: "100%",
    backgroundColor: "#16a34a",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  whatsappText: { color: "#fff", fontWeight: "800" },
  continueButton: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  continueText: { color: "#334155", fontWeight: "800" },
});
