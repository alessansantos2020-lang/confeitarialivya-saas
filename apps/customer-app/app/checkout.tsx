import { createOrder, fetchDeliveryFees, fetchPaymentMethods, type DeliveryFee, type PaymentMethods } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { PRIMARY_COLOR } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function CheckoutScreen() {
  const cart = useCart();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [reference, setReference] = useState("");
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "money" | "card">("pix");
  const [changeFor, setChangeFor] = useState("");
  const [observation, setObservation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const feesQuery = useQuery({ queryKey: ["fees"], queryFn: fetchDeliveryFees });
  const methodsQuery = useQuery({ queryKey: ["methods"], queryFn: fetchPaymentMethods });

  const fees: DeliveryFee[] = feesQuery.data ?? [];
  const methods: PaymentMethods | null = methodsQuery.data ?? null;

  const acceptCash = methods ? methods.accept_cash !== false : true;
  const acceptCard = methods ? methods.accept_card_delivery !== false : true;
  const acceptPix = methods
    ? methods.accept_manual_pix !== false || methods.online_pix_available === true
    : true;

  const currentFee = fees.find((f) => f.neighborhood === selectedNeighborhood)?.fee ?? 0;
  const subtotal = cart.getSubtotal();
  const total = subtotal + currentFee;

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim() || !street.trim() || !number.trim() || !selectedNeighborhood) {
      Alert.alert("Atenção", "Preencha todos os campos obrigatórios.");
      return;
    }

    if (cart.items.length === 0) {
      Alert.alert("Atenção", "Sua sacola está vazia.");
      return;
    }

    let parsedChange: number | null = null;
    if (paymentMethod === "money" && changeFor.trim()) {
      const v = parseFloat(changeFor.replace(",", "."));
      if (!Number.isNaN(v) && v > 0) {
        if (v < total) {
          Alert.alert(
            "Troco inválido",
            `O valor para troco (R$ ${v.toFixed(2)}) não pode ser menor que o total (R$ ${total.toFixed(2)}).`,
          );
          return;
        }
        parsedChange = v;
      }
    }

    try {
      setIsSubmitting(true);
      const addressFormatted = `${street}, ${number}${complement ? ` - ${complement}` : ""} - ${selectedNeighborhood}${reference ? ` (Ref: ${reference})` : ""}`;

      const created = await createOrder({
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        address: addressFormatted,
        neighborhood: selectedNeighborhood,
        street: street.trim(),
        number: number.trim(),
        complement: complement.trim() || null,
        reference: reference.trim() || null,
        payment_method: paymentMethod,
        change_for: parsedChange,
        observation: observation.trim() || null,
        items: cart.items.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
          observation: i.observation || null,
          selected_addons: i.addon_ids.map((id) => ({ id })),
        })),
      });

      cart.clearCart();
      const orderId = (created as { id?: string })?.id?.slice(0, 8).toUpperCase() || "";
      Alert.alert(
        "Pedido enviado!",
        `Seu pedido #${orderId} foi recebido pela loja. Acompanhe pelo WhatsApp.`,
        [{ text: "OK", onPress: () => router.replace("/") }],
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Não foi possível enviar o pedido.";
      Alert.alert("Erro", msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Stack.Screen title="Finalizar Pedido" />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: "#fff" }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text style={styles.section}>Seus Dados</Text>
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

          <Text style={styles.section}>Endereço de Entrega</Text>
          <TextInput
            placeholder="Rua / Avenida *"
            value={street}
            onChangeText={setStreet}
            style={styles.input}
          />
          <TextInput
            placeholder="Número *"
            value={number}
            onChangeText={setNumber}
            style={styles.input}
          />
          <TextInput
            placeholder="Complemento (apto, bloco...)"
            value={complement}
            onChangeText={setComplement}
            style={styles.input}
          />
          <TextInput
            placeholder="Ponto de referência"
            value={reference}
            onChangeText={setReference}
            style={styles.input}
          />

          <Text style={styles.section}>Bairro *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {fees.map((f) => (
              <Pressable
                key={f.neighborhood}
                onPress={() => setSelectedNeighborhood(f.neighborhood)}
                style={[
                  styles.chip,
                  selectedNeighborhood === f.neighborhood && styles.chipActive,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedNeighborhood === f.neighborhood && styles.chipTextActive,
                  ]}
                >
                  {f.neighborhood} (R$ {f.fee.toFixed(2).replace(".", ",")})
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.section}>Forma de Pagamento</Text>
          <View style={styles.row}>
            {acceptPix && (
              <Pressable
                onPress={() => setPaymentMethod("pix")}
                style={[styles.methodButton, paymentMethod === "pix" && styles.methodButtonActive]}
              >
                <Text
                  style={[styles.methodText, paymentMethod === "pix" && styles.methodTextActive]}
                >
                  Pix
                </Text>
              </Pressable>
            )}
            {acceptCash && (
              <Pressable
                onPress={() => setPaymentMethod("money")}
                style={[
                  styles.methodButton,
                  paymentMethod === "money" && styles.methodButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.methodText,
                    paymentMethod === "money" && styles.methodTextActive,
                  ]}
                >
                  Dinheiro
                </Text>
              </Pressable>
            )}
            {acceptCard && (
              <Pressable
                onPress={() => setPaymentMethod("card")}
                style={[styles.methodButton, paymentMethod === "card" && styles.methodButtonActive]}
              >
                <Text
                  style={[styles.methodText, paymentMethod === "card" && styles.methodTextActive]}
                >
                  Cartão
                </Text>
              </Pressable>
            )}
          </View>

          {paymentMethod === "money" && (
            <View style={styles.changeBox}>
              <Text style={styles.changeTitle}>Precisa de troco para quanto?</Text>
              <TextInput
                placeholder={`Ex: ${(total + 10).toFixed(2)} (total é R$ ${total.toFixed(2)})`}
                value={changeFor}
                onChangeText={setChangeFor}
                keyboardType="numeric"
                style={styles.input}
              />
            </View>
          )}

          <Text style={styles.section}>Observação</Text>
          <TextInput
            placeholder="Ex: sem cebola, campainha não toca..."
            value={observation}
            onChangeText={setObservation}
            multiline
            numberOfLines={2}
            style={[styles.input, { height: 60 }]}
          />

          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>R$ {subtotal.toFixed(2).replace(".", ",")}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Taxa de entrega</Text>
              <Text style={styles.summaryValue}>R$ {currentFee.toFixed(2).replace(".", ",")}</Text>
            </View>
            <View style={[styles.summaryRow, { marginTop: 6 }]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>R$ {total.toFixed(2).replace(".", ",")}</Text>
            </View>
          </View>

          <Pressable
            onPress={handleSubmit}
            disabled={isSubmitting}
            style={[styles.submitButton, isSubmitting && { opacity: 0.6 }]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>
                CONFIRMAR PEDIDO · R$ {total.toFixed(2).replace(".", ",")}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 14, fontWeight: "800", color: "#0f172a", marginTop: 16, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    backgroundColor: "#fff",
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginRight: 6,
    backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: PRIMARY_COLOR, borderColor: PRIMARY_COLOR },
  chipText: { fontSize: 12, color: "#334155" },
  chipTextActive: { color: "#fff", fontWeight: "700" },
  row: { flexDirection: "row", gap: 8, marginBottom: 8 },
  methodButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
  },
  methodButtonActive: { backgroundColor: PRIMARY_COLOR, borderColor: PRIMARY_COLOR },
  methodText: { fontWeight: "700", color: "#334155" },
  methodTextActive: { color: "#fff" },
  changeBox: { backgroundColor: "#fff7ed", padding: 12, borderRadius: 8, marginBottom: 8 },
  changeTitle: { fontSize: 12, fontWeight: "700", color: "#9a3412", marginBottom: 6 },
  summaryBox: {
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 16,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  summaryLabel: { color: "#64748b", fontSize: 13 },
  summaryValue: { color: "#0f172a", fontSize: 13, fontWeight: "600" },
  totalLabel: { color: "#0f172a", fontSize: 16, fontWeight: "800" },
  totalValue: { color: PRIMARY_COLOR, fontSize: 18, fontWeight: "800" },
  submitButton: {
    backgroundColor: PRIMARY_COLOR,
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 24,
  },
  submitText: { color: "#fff", fontWeight: "800", fontSize: 14 },
});
