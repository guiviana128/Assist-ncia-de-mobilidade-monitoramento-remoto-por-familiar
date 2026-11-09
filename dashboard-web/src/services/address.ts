// Explicit postal searches only. No personal address is sent until the user requests a lookup.
export async function lookupCep(value: string, request: typeof fetch = fetch) {
  const cep = value.replace(/\D/g, "");
  if (cep.length !== 8) throw Error("Informe um CEP com 8 dígitos.");
  const res = await request(`https://viacep.com.br/ws/${cep}/json/`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok)
    throw Error("Consulta indisponível. Preencha o endereço manualmente.");
  const body = await res.json();
  if (body.erro) throw Error("CEP não encontrado. Preencha manualmente.");
  if (body.uf !== "SP")
    throw Error("Informe um endereço do estado de São Paulo.");
  return {
    cep: body.cep ?? cep,
    street: body.logradouro ?? "",
    district: body.bairro ?? "",
    city: body.localidade ?? "",
    state: "SP",
  };
}
export interface AddressCandidate {
  label: string;
  lat: number;
  lng: number;
}
let lastSearch = 0;
const cache = new Map<string, AddressCandidate[]>();
export async function searchAddress(
  query: string,
): Promise<AddressCandidate[]> {
  if (cache.has(query)) return cache.get(query)!;
  if (Date.now() - lastSearch < 1500)
    throw Error("Aguarde um instante antes de buscar novamente.");
  lastSearch = Date.now();
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    countrycodes: "br",
    limit: "5",
    viewbox: "-53.5,-19.5,-44,-25.5",
    bounded: "1",
  });
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    {
      signal: AbortSignal.timeout(15000),
      headers: { "Accept-Language": "pt-BR" },
    },
  );
  if (!res.ok)
    throw Error(
      "Busca no mapa indisponível. Você pode marcar o ponto manualmente.",
    );
  const body = await res.json();
  const results = body
    .map((r: { display_name: string; lat: string; lon: string }) => ({
      label: r.display_name,
      lat: Number(r.lat),
      lng: Number(r.lon),
    }))
    .filter(
      (r: AddressCandidate) => Number.isFinite(r.lat) && Number.isFinite(r.lng),
    );
  cache.set(query, results);
  return results;
}
