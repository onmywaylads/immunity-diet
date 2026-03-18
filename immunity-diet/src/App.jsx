import { useState, useEffect } from "react";

const STORAGE_KEY   = "immunity-diet-history";
const PREFS_KEY     = "immunity-diet-prefs";
const FAVORITES_KEY = "immunity-diet-favorites";

const today = () => new Date().toISOString().split("T")[0];
const formatDate = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
};

const MEAL_ORDER = ["아침", "점심", "오후간식", "저녁"];
const MEAL_META = {
  아침:     { icon: "🌅", bg: "#fff8f0", accent: "#d4772a", label: "아침 식사",  time: "07:00 – 08:30" },
  점심:     { icon: "☀️", bg: "#f0faf3", accent: "#5aaa80", label: "점심 식사",  time: "12:00 – 13:30" },
  오후간식: { icon: "🍵", bg: "#fdf5ff", accent: "#8b5db5", label: "오후 간식",  time: "15:00 – 16:00" },
  저녁:     { icon: "🌙", bg: "#f0f4ff", accent: "#3a5bbf", label: "저녁 식사",  time: "18:00 – 19:30" },
};

const INGREDIENT_OPTIONS = {
  "단백질류": [
    { id: "fish",    emoji: "🐟", label: "생선" },
    { id: "chicken", emoji: "🍗", label: "닭가슴살" },
    { id: "egg",     emoji: "🥚", label: "달걀" },
    { id: "tofu",    emoji: "🫘", label: "두부" },
    { id: "beef",    emoji: "🥩", label: "소고기" },
    { id: "pork",    emoji: "🐷", label: "돼지고기" },
  ],
  "채소류": [
    { id: "broccoli", emoji: "🥦", label: "브로콜리" },
    { id: "carrot",   emoji: "🥕", label: "당근" },
    { id: "mushroom", emoji: "🍄", label: "버섯" },
    { id: "spinach",  emoji: "🥬", label: "시금치" },
    { id: "potato",   emoji: "🥔", label: "감자" },
    { id: "zucchini", emoji: "🫑", label: "애호박" },
    { id: "onion",    emoji: "🧅", label: "양파" },
    { id: "tomato",   emoji: "🍅", label: "토마토" },
  ],
  "해산물": [
    { id: "shrimp",   emoji: "🦐", label: "새우" },
    { id: "clam",     emoji: "🐚", label: "조개" },
    { id: "mackerel", emoji: "🐠", label: "고등어" },
    { id: "squid",    emoji: "🦑", label: "오징어" },
  ],
  "곡류/기타": [
    { id: "rice",      emoji: "🍚", label: "흰쌀" },
    { id: "brownrice", emoji: "🌾", label: "현미" },
    { id: "seaweed",   emoji: "🌿", label: "미역/다시마" },
    { id: "corn",      emoji: "🌽", label: "옥수수" },
  ],
};

const EXCLUDE_OPTIONS = [
  { id: "spicy",   emoji: "🌶️", label: "매운 음식" },
  { id: "raw",     emoji: "🍣",  label: "날것 (회 등)" },
  { id: "dairy",   emoji: "🥛",  label: "유제품" },
  { id: "gluten",  emoji: "🍞",  label: "밀가루/글루텐" },
  { id: "nuts",    emoji: "🥜",  label: "견과류" },
  { id: "greasy",  emoji: "🍳",  label: "기름진 음식" },
  { id: "salty",   emoji: "🧂",  label: "짠 음식" },
  { id: "cold",    emoji: "🧊",  label: "차가운 음식" },
];

const ALL_INGREDIENTS = Object.values(INGREDIENT_OPTIONS).flat();
const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

// ── 실제 한국 가정식 레시피 기반 프롬프트 (웹검색 없이 내장 지식 활용)
function buildSystemPrompt(liked, excluded, favorites) {
  const likedStr   = liked.length     > 0 ? `선호 재료 (반드시 포함): ${liked.join(", ")}` : "선호 재료: 제한 없음";
  const excludeStr = excluded.length  > 0 ? `절대 제외 (사용 금지): ${excluded.join(", ")}` : "제외 항목: 없음";
  const favStr     = favorites.length > 0 ? `즐겨찾기 메뉴 (가끔 포함): ${favorites.join(", ")}` : "";

  return `당신은 20년 경력의 한국 가정식 요리 전문가이자 영양사입니다.
당신은 한국 요리책, 만개의레시피, 해먹남녀, 백종원 레시피에 정통한 전문가입니다.

${likedStr}
${excludeStr}
${favStr}

【반드시 지킬 규칙】
1. 실제로 존재하는 한국 가정식 메뉴만 사용 (예: 시금치된장국, 고등어조림, 두부계란찜, 콩나물국밥 등)
2. 재료 양을 정확히 명시 (예: 두부 1/2모(150g), 된장 1큰술, 참기름 1작은술)
3. 조리 단계는 실제 요리하듯 구체적으로 (예: "중불에서 3분간 볶는다", "뚜껑 덮고 약불로 10분")
4. 소화가 잘 되는 부드러운 조리법 우선 (찜, 조림, 국, 찌개)
5. 튀김, 훈제, 가공육 사용 금지
6. 항산화/항염증 재료 포함 (브로콜리, 당근, 버섯, 생강, 강황, 오메가-3 생선류)

반드시 아래 JSON 형식만 반환하세요. 코드블록 없이 순수 JSON만:
{
  "theme": "오늘의 식단 테마 한 줄 (예: 고등어와 나물로 채운 든든한 하루)",
  "tip": "오늘의 건강 팁 (구체적인 영양 정보 포함)",
  "meals": {
    "아침":     { "name": "실제 메뉴명", "description": "한 줄 설명", "ingredients": ["두부 1/2모(150g)", "달걀 2개"], "recipe": ["냄비에 물 500ml를 붓고 끓인다", "두부를 2cm 크기로 깍둑썬다"], "nutrition": "약 350kcal, 단백질 18g, 탄수화물 40g", "benefit": "면역력에 좋은 이유" },
    "점심":     { "name": "", "description": "", "ingredients": [], "recipe": [], "nutrition": "", "benefit": "" },
    "오후간식": { "name": "", "description": "", "ingredients": [], "recipe": [], "nutrition": "", "benefit": "" },
    "저녁":     { "name": "", "description": "", "ingredients": [], "recipe": [], "nutrition": "", "benefit": "" }
  }
}`;
}

async function generateDiet(dateStr, liked, excluded, favorites, previousMeals) {
  const prevList = previousMeals.length > 0
    ? `이미 사용한 메뉴 (중복 금지): ${previousMeals.slice(-20).join(", ")}`
    : "";

  const userMsg = `${dateStr} 날짜 면역력 강화 맞춤 식단을 만들어주세요.
${prevList}
순수 JSON만 반환하세요. 설명이나 코드블록 없이.`;

  // 최대 3회 재시도, 점진적 대기
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2500,
        system: buildSystemPrompt(liked, excluded, favorites),
        messages: [{ role: "user", content: userMsg }],
      }),
    });

    if (res.status === 429) {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 8000)); // 8초, 16초 대기
        continue;
      }
      throw new Error("429");
    }

    const data = await res.json();
    const text = data.content?.find((b) => b.type === "text")?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON 파싱 실패");
    return JSON.parse(jsonMatch[0]);
  }
}

/* ── 재료 선택 화면 ─────────────────────────────── */
function PreferenceScreen({ initialPrefs, onConfirm, onCancel }) {
  // catAll: 카테고리별 "다 좋아요" 상태 (Set)
  const [catAll,   setCatAll]   = useState(() => new Set(initialPrefs?.catAll   || []));
  const [liked,    setLiked]    = useState(initialPrefs?.likedIds    || []);
  const [excluded, setExcluded] = useState(initialPrefs?.excludedIds || []);
  const [step,     setStep]     = useState(1);

  const toggleItem = (id) =>
    setLiked((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const toggleCatAll = (cat) => {
    setCatAll((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
        // 해당 카테고리 개별 선택 해제
        const catIds = INGREDIENT_OPTIONS[cat].map((o) => o.id);
        setLiked((pl) => pl.filter((id) => !catIds.includes(id)));
      }
      return next;
    });
  };

  // 선택된 재료 라벨 계산 (다 좋아요 카테고리는 전체 포함)
  const likedLabels = [
    ...Array.from(catAll).flatMap((cat) => INGREDIENT_OPTIONS[cat].map((o) => o.label)),
    ...ALL_INGREDIENTS.filter((o) => liked.includes(o.id)).map((o) => o.label),
  ];
  const excludedLabels = EXCLUDE_OPTIONS.filter((o) => excluded.includes(o.id)).map((o) => o.label);

  const hasSelection = catAll.size > 0 || liked.length > 0;

  return (
    <div style={{ minHeight: "100vh", background: "#f7f5f0", fontFamily: "'Georgia', serif" }}>
      <div style={{ background: "linear-gradient(150deg,#2d6b4a,#5aaa80 55%,#7dc4a0)", padding: "32px 24px 28px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
        <div style={{ maxWidth: 700, margin: "0 auto", position: "relative" }}>
          <div style={{ fontSize: 11, letterSpacing: 4, color: "rgba(255,255,255,0.4)", marginBottom: 10, textTransform: "uppercase", fontFamily: "sans-serif" }}>오늘의 식단 준비</div>
          <h1 style={{ fontSize: 24, fontWeight: "normal", color: "#fff", margin: "0 0 6px" }}>🌿 식재료 선택</h1>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", margin: 0, fontFamily: "sans-serif" }}>
            선택하신 재료로 실제 황금레시피를 검색해 식단을 구성해 드려요
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "20px 16px 40px" }}>

        {/* 탭 — 제외할 음식은 재료 선택 완료 전까지 잠김 */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          <button onClick={() => setStep(1)} style={{ flex: 1, padding: "12px 0", borderRadius: 14, cursor: "pointer", background: step === 1 ? "#5aaa80" : "#fff", border: `1.5px solid ${step === 1 ? "#5aaa80" : "#e4ddd4"}`, color: step === 1 ? "#fff" : "#888", fontSize: 13, fontFamily: "sans-serif", fontWeight: step === 1 ? "bold" : "normal", transition: "all 0.2s" }}>
            ✓ 좋아하는 재료 {hasSelection ? `(${likedLabels.length}개)` : ""}
          </button>
          <button
            onClick={() => { if (hasSelection) setStep(2); }}
            style={{ flex: 1, padding: "12px 0", borderRadius: 14, cursor: hasSelection ? "pointer" : "not-allowed", background: step === 2 ? "#5aaa80" : hasSelection ? "#fff" : "#f5f5f5", border: `1.5px solid ${step === 2 ? "#5aaa80" : hasSelection ? "#e4ddd4" : "#eee"}`, color: step === 2 ? "#fff" : hasSelection ? "#888" : "#ccc", fontSize: 13, fontFamily: "sans-serif", fontWeight: step === 2 ? "bold" : "normal", transition: "all 0.2s" }}
          >
            ✕ 제외할 음식 {!hasSelection && "🔒"}
          </button>
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <div>
            <p style={{ fontSize: 13, color: "#888", fontFamily: "sans-serif", margin: "0 0 20px", lineHeight: 1.8 }}>
              카테고리별로 <strong>다 좋아요</strong>를 누르거나, 원하는 재료를 직접 선택해 주세요
            </p>

            {Object.entries(INGREDIENT_OPTIONS).map(([cat, items]) => {
              const isAllOn = catAll.has(cat);
              return (
                <div key={cat} style={{ marginBottom: 16, background: "#fff", borderRadius: 16, padding: "16px", border: `1.5px solid ${isAllOn ? "#5aaa80" : "#e8e0d6"}`, transition: "border-color 0.2s" }}>
                  <h3 style={{ fontSize: 11, color: isAllOn ? "#5aaa80" : "#aaa", letterSpacing: 2, fontFamily: "sans-serif", textTransform: "uppercase", margin: "0 0 12px", fontWeight: "bold" }}>{cat}</h3>
                  {/* 개별 재료 버튼 — 다 좋아요 맨 앞에 */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {/* 다 좋아요 버튼 — 맨 앞 */}
                    <button
                      onClick={() => toggleCatAll(cat)}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 20, cursor: "pointer", background: isAllOn ? "#5aaa80" : "#f0faf5", color: isAllOn ? "#fff" : "#3d7a5a", border: `1.5px solid ${isAllOn ? "#5aaa80" : "#b8dfc8"}`, fontSize: 13, fontFamily: "sans-serif", fontWeight: "bold", transition: "all 0.15s" }}
                    >
                      🙆 다 좋아요 {isAllOn && "✓"}
                    </button>

                    {/* 개별 재료 */}
                    {items.map((item) => {
                      const on = liked.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          onClick={() => { if (!isAllOn) toggleItem(item.id); }}
                          style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 20, cursor: isAllOn ? "default" : "pointer", background: isAllOn ? "#f0faf5" : on ? "#5aaa80" : "#f8f8f8", color: isAllOn ? "#aaa" : on ? "#fff" : "#3a2e1e", border: `1.5px solid ${isAllOn ? "#ddf0e8" : on ? "#5aaa80" : "#e8e8e8"}`, fontSize: 13, fontFamily: "sans-serif", opacity: isAllOn ? 0.6 : 1, transition: "all 0.15s" }}
                        >
                          {item.emoji} {item.label} {on && !isAllOn && "✓"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {!hasSelection && (
              <p style={{ textAlign: "center", fontSize: 13, color: "#e8a070", fontFamily: "sans-serif", margin: "8px 0" }}>
                ☝️ 재료를 1개 이상 선택해야 다음으로 넘어갈 수 있어요
              </p>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button
                onClick={() => onCancel && onCancel()}
                style={{ flex: 1, background: "#fff", color: "#888", border: "1.5px solid #e4ddd4", borderRadius: 16, padding: "14px", fontSize: 14, cursor: "pointer", fontFamily: "sans-serif" }}
              >← 뒤로</button>
              <button
                onClick={() => { if (hasSelection) setStep(2); }}
                disabled={!hasSelection}
                style={{ flex: 2, background: hasSelection ? "#5aaa80" : "#e0e0e0", color: hasSelection ? "#fff" : "#aaa", border: "none", borderRadius: 16, padding: "15px", fontSize: 15, cursor: hasSelection ? "pointer" : "default", fontFamily: "sans-serif", transition: "all 0.2s" }}
              >
                {hasSelection ? `다음 → 제외할 음식 선택 (${likedLabels.length}개)` : "재료를 선택해 주세요"}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div>
            <p style={{ fontSize: 13, color: "#888", fontFamily: "sans-serif", margin: "0 0 20px", lineHeight: 1.8 }}>
              드시기 어렵거나 피해야 할 음식을 선택해 주세요.<br />
              <span style={{ fontSize: 12, color: "#bbb" }}>선택하지 않아도 괜찮아요</span>
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 28 }}>
              {EXCLUDE_OPTIONS.map((item) => {
                const on = excluded.includes(item.id);
                return (
                  <button key={item.id} onClick={() => setExcluded((prev) => prev.includes(item.id) ? prev.filter((x) => x !== item.id) : [...prev, item.id])} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 20, cursor: "pointer", background: on ? "#c0392b" : "#fff", color: on ? "#fff" : "#3a2e1e", border: `1.5px solid ${on ? "#c0392b" : "#e4ddd4"}`, fontSize: 13, fontFamily: "sans-serif", transition: "all 0.15s" }}>
                    {item.emoji} {item.label} {on && "✕"}
                  </button>
                );
              })}
            </div>

            <div style={{ background: "#fff", borderRadius: 16, padding: "16px 20px", border: "1px solid #e4ddd4", marginBottom: 16 }}>
              <p style={{ fontSize: 11, color: "#bbb", fontFamily: "sans-serif", margin: "0 0 10px", letterSpacing: 1, textTransform: "uppercase" }}>오늘 식단 요약</p>
              <div style={{ fontSize: 13, fontFamily: "sans-serif", lineHeight: 2.2, color: "#3a2e1e" }}>
                <span style={{ color: "#5aaa80", fontWeight: "bold" }}>✓ 선호</span>{"  "}
                {likedLabels.length > 0 ? likedLabels.join(", ") : "제한 없음"}<br />
                <span style={{ color: "#c0392b", fontWeight: "bold" }}>✕ 제외</span>{"  "}
                {excludedLabels.length > 0 ? excludedLabels.join(", ") : "없음"}
              </div>
            </div>

            <div style={{ background: "#f0f7ff", borderRadius: 12, padding: "12px 16px", marginBottom: 20, border: "1px solid #c8dff8" }}>
              <p style={{ fontSize: 12, color: "#3a6bbf", fontFamily: "sans-serif", margin: 0, lineHeight: 1.8 }}>
                🔍 <strong>황금레시피 검색 포함</strong> — 각 메뉴마다 실제 레시피를 검색하므로 약 30초~1분 소요
              </p>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(1)} style={{ flex: 1, background: "#fff", color: "#888", border: "1.5px solid #e4ddd4", borderRadius: 16, padding: "14px", fontSize: 14, cursor: "pointer", fontFamily: "sans-serif" }}>← 뒤로</button>
              <button onClick={() => onConfirm(liked, excluded, likedLabels, excludedLabels, Array.from(catAll))} style={{ flex: 2, background: "#5aaa80", color: "#fff", border: "none", borderRadius: 16, padding: "14px", fontSize: 15, cursor: "pointer", fontFamily: "sans-serif", fontWeight: "bold" }}>
                🔍 황금레시피로 식단 생성
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── 로딩 화면 ─────────────────────────────────── */
function LoadingScreen() {
  const [msgIdx, setMsgIdx] = useState(0);
  const messages = [
    "🌿 오늘의 메뉴를 고르고 있어요...",
    "🍳 재료와 조리법을 정리하고 있어요...",
    "🥦 영양 균형을 맞추고 있어요...",
    "✨ 거의 다 됐어요!",
  ];
  useEffect(() => {
    const t = setInterval(() => setMsgIdx((i) => Math.min(i + 1, messages.length - 1)), 5000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ background: "#fff", borderRadius: 20, padding: "70px 24px", textAlign: "center", border: "1px solid #e4ddd4" }}>
      <div style={{ fontSize: 44, marginBottom: 20, display: "inline-block", animation: "pulse 1.5s ease-in-out infinite" }}>🌿</div>
      <p style={{ color: "#5aaa80", fontSize: 16, margin: "0 0 10px" }}>{messages[msgIdx]}</p>
      <p style={{ color: "#bbb", fontSize: 12, margin: "0 0 24px", fontFamily: "sans-serif" }}>잠시만 기다려주세요 (약 10~20초)</p>
      <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
        {messages.map((_, i) => (
          <div key={i} style={{ width: i === msgIdx ? 20 : 6, height: 6, borderRadius: 3, background: i === msgIdx ? "#5aaa80" : "#e0e0e0", transition: "all 0.3s" }} />
        ))}
      </div>
      <style>{`@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}`}</style>
    </div>
  );
}

/* ── 즐겨찾기 탭 ─────────────────────────────── */
function FavoritesTab({ favorites, onClose }) {
  if (favorites.length === 0) return (
    <div style={{ background: "#fff", borderRadius: 16, padding: "32px 24px", border: "1px solid #e4ddd4", textAlign: "center" }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>🤍</div>
      <p style={{ color: "#aaa", fontSize: 14, fontFamily: "sans-serif" }}>
        아직 즐겨찾기한 메뉴가 없어요<br />
        <span style={{ fontSize: 12 }}>맛있는 메뉴의 🤍 버튼을 눌러보세요</span>
      </p>
    </div>
  );
  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: "16px 20px", border: "1px solid #e4ddd4", marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <p style={{ fontSize: 13, color: "#5aaa80", fontFamily: "sans-serif", margin: 0, fontWeight: "bold" }}>
          ❤️ 즐겨찾기 메뉴 ({favorites.length}개)
        </p>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#ccc", cursor: "pointer", fontSize: 18 }}>×</button>
      </div>
      <p style={{ fontSize: 12, color: "#aaa", fontFamily: "sans-serif", margin: "0 0 12px" }}>
        식단 생성 시 이 메뉴들이 가끔 다시 추천돼요
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {favorites.map((name, i) => (
          <div key={i} style={{ background: "#fff0f0", border: "1px solid #f5c0c0", borderRadius: 20, padding: "6px 14px", fontSize: 13, color: "#c0392b", fontFamily: "sans-serif" }}>
            ❤️ {name}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 메인 앱 ─────────────────────────────────────── */
export default function App() {
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
  });
  const [prefs, setPrefs] = useState(() => {
    try { return JSON.parse(localStorage.getItem(PREFS_KEY) || "null"); } catch { return null; }
  });
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]"); } catch { return []; }
  });

  const [selectedDate,   setSelectedDate]   = useState(today());
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState(null);
  const [expandedMeal,   setExpandedMeal]   = useState(null);
  const [showHistory,    setShowHistory]    = useState(false);
  const [showFavorites,  setShowFavorites]  = useState(false);
  const [showPrefScreen, setShowPrefScreen] = useState(false);

  useEffect(() => {
    if (!history[today()]) setShowPrefScreen(true);
  }, []);

  const saveHistory  = (h) => { setHistory(h);  localStorage.setItem(STORAGE_KEY,   JSON.stringify(h)); };
  const saveFavorites = (f) => { setFavorites(f); localStorage.setItem(FAVORITES_KEY, JSON.stringify(f)); };

  const toggleFavorite = (mealName) => {
    const updated = favorites.includes(mealName)
      ? favorites.filter((n) => n !== mealName)
      : [...favorites, mealName];
    saveFavorites(updated);
  };

  const handleConfirm = async (likedIds, excludedIds, likedLabels, excludedLabels, catAll) => {
    const newPrefs = { likedIds, excludedIds, likedLabels, excludedLabels, catAll };
    setPrefs(newPrefs);
    localStorage.setItem(PREFS_KEY, JSON.stringify(newPrefs));
    setShowPrefScreen(false);
    await runGenerate(today(), likedLabels, excludedLabels);
  };

  const runGenerate = async (dateStr, liked, excluded) => {
    const l = liked    ?? prefs?.likedLabels    ?? [];
    const e = excluded ?? prefs?.excludedLabels ?? [];
    setLoading(true); setError(null); setExpandedMeal(null);
    try {
      const prev = Object.values(history).flatMap((d) =>
        d?.meals ? Object.values(d.meals).map((m) => m.name) : []
      );
      const data = await generateDiet(dateStr, l, e, favorites, prev);
      saveHistory({ ...history, [dateStr]: data });
      setSelectedDate(dateStr);
    } catch (err) {
      console.error(err);
      if (err?.message?.includes("429") || String(err).includes("429")) {
        setError("__429__");
      } else {
        setError("식단 생성 중 오류가 발생했습니다. 다시 시도해주세요.");
      }
    } finally {
      setLoading(false);
    }
  };

  // 뒤로가기: 기존 식단 있으면 메인으로, 없으면 pref 화면 유지
  const handleCancel = () => {
    const hasTodayDiet = !!history[today()];
    if (hasTodayDiet) setShowPrefScreen(false);
    // 식단 없으면 그냥 pref 화면에 머뭄 (뒤로가기 무효)
  };

  if (showPrefScreen) return <PreferenceScreen initialPrefs={prefs} onConfirm={handleConfirm} onCancel={handleCancel} />;

  const currentDiet = history[selectedDate];
  const sortedDates = Object.keys(history).sort((a, b) => b.localeCompare(a));

  return (
    <div style={{ minHeight: "100vh", background: "#f7f5f0", fontFamily: "'Georgia', serif", color: "#1e1a12" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(150deg,#2d6b4a,#5aaa80 55%,#7dc4a0)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -60, right: -60, width: 220, height: 220, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
        <div style={{ maxWidth: 700, margin: "0 auto", padding: "36px 24px 28px", position: "relative" }}>
          <div style={{ fontSize: 11, letterSpacing: 4, color: "rgba(255,255,255,0.4)", marginBottom: 12, textTransform: "uppercase", fontFamily: "sans-serif" }}>회복을 응원하는 맞춤 식단</div>
          <h1 style={{ fontSize: 26, fontWeight: "normal", color: "#fff", margin: "0 0 6px" }}>🌿 면역력 강화 맞춤 식단</h1>
          {prefs?.likedLabels?.length > 0 && (
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", margin: "0 0 14px", fontFamily: "sans-serif" }}>
              선호: {prefs.likedLabels.join(" · ")}
              {prefs?.excludedLabels?.length > 0 && `  |  제외: ${prefs.excludedLabels.join(" · ")}`}
            </p>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 30, padding: "6px 16px" }}>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", fontFamily: "sans-serif" }}>📅 {formatDate(selectedDate)}</span>
            </div>
            <button onClick={() => setShowPrefScreen(true)} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 30, padding: "6px 14px", color: "rgba(255,255,255,0.8)", fontSize: 12, cursor: "pointer", fontFamily: "sans-serif" }}>
              ⚙️ 재료 변경
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "20px 16px 60px" }}>

        {/* 오늘 새로 생성 버튼 - 눈에 띄게 */}
        <button
          onClick={() => setShowPrefScreen(true)}
          disabled={loading}
          style={{ width: "100%", background: loading ? "#ccc" : "linear-gradient(135deg,#5aaa80,#5aaa80)", color: "#fff", border: "none", borderRadius: 16, padding: "16px", fontSize: 15, cursor: loading ? "default" : "pointer", fontFamily: "sans-serif", fontWeight: "bold", marginBottom: 16, boxShadow: loading ? "none" : "0 4px 16px rgba(90,170,128,0.3)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          {loading ? "⏳ 황금레시피 검색 중..." : "🔄 오늘의 식단 새로 생성하기"}
        </button>

        {/* 기록 / 즐겨찾기 */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <button onClick={() => { setShowHistory(!showHistory); setShowFavorites(false); }} style={{ background: showHistory ? "#5aaa80" : "#fff", color: showHistory ? "#fff" : "#5aaa80", border: "1.5px solid #5aaa80", borderRadius: 20, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: "sans-serif" }}>
            📋 기록 {sortedDates.length > 0 ? `(${sortedDates.length})` : ""}
          </button>
          <button onClick={() => { setShowFavorites(!showFavorites); setShowHistory(false); }} style={{ background: showFavorites ? "#c0392b" : "#fff", color: showFavorites ? "#fff" : "#c0392b", border: "1.5px solid #c0392b", borderRadius: 20, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: "sans-serif" }}>
            ❤️ 즐겨찾기 {favorites.length > 0 ? `(${favorites.length})` : ""}
          </button>
        </div>

        {/* 즐겨찾기 패널 */}
        {showFavorites && <FavoritesTab favorites={favorites} onClose={() => setShowFavorites(false)} />}

        {/* 날짜 기록 패널 */}
        {showHistory && sortedDates.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 16, marginBottom: 16, border: "1px solid #e4ddd4" }}>
            <p style={{ margin: "0 0 12px", fontSize: 11, color: "#bbb", fontFamily: "sans-serif", letterSpacing: 1, textTransform: "uppercase" }}>저장된 날짜</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {sortedDates.map((d) => (
                <button key={d} onClick={() => { setSelectedDate(d); setShowHistory(false); setExpandedMeal(null); }}
                  style={{ background: d === selectedDate ? "#5aaa80" : "#f0ede7", color: d === selectedDate ? "#fff" : "#3a2e1e", border: "none", borderRadius: 12, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontFamily: "sans-serif" }}>
                  {d === today() ? `오늘 (${d})` : d}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div style={{ background: error === "__429__" ? "#fffbf0" : "#fff0ed", border: `1px solid ${error === "__429__" ? "#f5d78e" : "#e8a090"}`, borderRadius: 12, padding: 16, marginBottom: 16, fontFamily: "sans-serif" }}>
            {error === "__429__" ? (
              <div>
                <p style={{ fontSize: 14, color: "#b07a10", margin: "0 0 8px", fontWeight: "bold" }}>⏳ API 요청이 너무 많아요</p>
                <p style={{ fontSize: 13, color: "#8a6010", margin: "0 0 12px", lineHeight: 1.7 }}>
                  웹 검색을 포함한 식단 생성은 시간이 필요해요.<br />
                  1~2분 후 다시 시도해 주세요.
                </p>
                <button
                  onClick={() => { setError(null); setShowPrefScreen(true); }}
                  style={{ background: "#5aaa80", color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 13, cursor: "pointer", fontFamily: "sans-serif" }}
                >
                  🔄 다시 시도하기
                </button>
              </div>
            ) : (
              <p style={{ fontSize: 14, color: "#c0392b", margin: 0 }}>⚠️ {error}</p>
            )}
          </div>
        )}

        {loading && <LoadingScreen />}

        {!loading && currentDiet && (
          <div>
            {/* 테마 & 팁 */}
            <div style={{ background: "linear-gradient(135deg,#f5f0e8,#fff)", borderRadius: 20, padding: "22px 24px", marginBottom: 14, border: "1px solid #e4ddd4", boxShadow: "0 4px 16px rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: 17, fontStyle: "italic", marginBottom: 14, lineHeight: 1.5 }}>{currentDiet.theme}</div>
              <div style={{ background: "#f0faf5", borderRadius: 12, padding: "12px 16px", fontSize: 13, color: "#3d7a5a", lineHeight: 1.8, fontFamily: "sans-serif" }}>
                💡 <strong>오늘의 건강 팁</strong><br />{currentDiet.tip || "항산화 식품을 충분히 섭취하고, 규칙적인 식사 시간을 지켜주세요."}
              </div>
            </div>

            {/* 끼니 카드 */}
            {MEAL_ORDER.map((mealName) => {
              const meal = currentDiet.meals?.[mealName];
              if (!meal) return null;
              const meta = MEAL_META[mealName];
              const isExpanded  = expandedMeal === mealName;
              const isFavorited = favorites.includes(meal.name);

              return (
                <div key={mealName} style={{ background: "#fff", borderRadius: 20, marginBottom: 12, border: "1px solid #e8e0d6", boxShadow: isExpanded ? "0 6px 24px rgba(0,0,0,0.08)" : "0 2px 10px rgba(0,0,0,0.04)", overflow: "hidden" }}>
                  {/* 헤더 */}
                  <div style={{ display: "flex", alignItems: "center", padding: "18px 20px", gap: 14 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0, background: meta.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, border: `1.5px solid ${meta.accent}22` }}>{meta.icon}</div>
                    <button onClick={() => setExpandedMeal(isExpanded ? null : mealName)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: 11, color: meta.accent, fontFamily: "sans-serif", fontWeight: "bold", letterSpacing: 0.5 }}>{meta.label}</span>
                        <span style={{ fontSize: 10, color: "#ccc", fontFamily: "sans-serif" }}>{meta.time}</span>
                      </div>
                      <div style={{ fontSize: 17, fontWeight: "bold", marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#1e1a12" }}>{meal.name}</div>
                      <div style={{ fontSize: 12, color: "#999", fontFamily: "sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{meal.description}</div>
                    </button>
                    {/* 즐겨찾기 버튼 */}
                    <button
                      onClick={() => toggleFavorite(meal.name)}
                      title={isFavorited ? "즐겨찾기 해제" : "맛있어요! 다음에 또 추천받기"}
                      style={{ flexShrink: 0, background: isFavorited ? "#fff0f0" : "#f8f8f8", border: `1.5px solid ${isFavorited ? "#f5c0c0" : "#eee"}`, borderRadius: 12, width: 40, height: 40, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
                    >
                      {isFavorited ? "❤️" : "🤍"}
                    </button>
                    {/* 펼치기 */}
                    <button onClick={() => setExpandedMeal(isExpanded ? null : mealName)} style={{ background: "none", border: "none", fontSize: 16, color: meta.accent, cursor: "pointer", flexShrink: 0, transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.25s" }}>▾</button>
                  </div>

                  {/* 펼쳐진 상세 */}
                  {isExpanded && (
                    <div style={{ borderTop: `1px solid ${meta.accent}18`, padding: "0 20px 22px" }}>
                      {/* 폐암 효능 */}
                      <div style={{ background: meta.bg, borderRadius: 12, padding: "12px 16px", margin: "16px 0", fontSize: 13, color: meta.accent, lineHeight: 1.7, fontFamily: "sans-serif", border: `1px solid ${meta.accent}22` }}>
                        🫁 <strong>회복에 좋은 이유:</strong> {meal.benefit}
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18 }}>
                        <div>
                          <h4 style={{ margin: "0 0 10px", fontSize: 11, color: "#c8673a", letterSpacing: 1, fontFamily: "sans-serif", textTransform: "uppercase" }}>재료</h4>
                          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                            {meal.ingredients?.map((ing, i) => <li key={i} style={{ fontSize: 12, color: "#3a2e1e", padding: "4px 0", fontFamily: "sans-serif", borderBottom: "1px dotted #f0e8e0" }}>· {ing}</li>)}
                          </ul>
                        </div>
                        <div>
                          <h4 style={{ margin: "0 0 10px", fontSize: 11, color: "#5aaa80", letterSpacing: 1, fontFamily: "sans-serif", textTransform: "uppercase" }}>영양 정보</h4>
                          <p style={{ fontSize: 12, color: "#666", fontFamily: "sans-serif", lineHeight: 1.7, margin: 0 }}>{meal.nutrition}</p>
                        </div>
                      </div>

                      <h4 style={{ margin: "0 0 12px", fontSize: 11, letterSpacing: 1, fontFamily: "sans-serif", textTransform: "uppercase" }}>조리 방법</h4>
                      <ol style={{ margin: 0, padding: "0 0 0 18px" }}>
                        {meal.recipe?.map((step, i) => <li key={i} style={{ fontSize: 13, color: "#3a2e1e", padding: "5px 0", fontFamily: "sans-serif", lineHeight: 1.7 }}>{step.replace(/^\d+\.\s*/, "")}</li>)}
                      </ol>

                      {meal.source && (
                        <div style={{ marginTop: 14, padding: "8px 12px", background: "#f8f8f8", borderRadius: 8, fontSize: 11, color: "#aaa", fontFamily: "sans-serif" }}>
                          📌 레시피 참고: {meal.source}
                        </div>
                      )}

                      {/* 즐겨찾기 안내 */}
                      {!isFavorited && (
                        <button onClick={() => toggleFavorite(meal.name)} style={{ marginTop: 14, width: "100%", background: "#fff0f0", border: "1.5px dashed #f5c0c0", borderRadius: 12, padding: "10px", fontSize: 13, color: "#c0392b", cursor: "pointer", fontFamily: "sans-serif" }}>
                          🤍 맛있었다면? 다음에 또 추천받기
                        </button>
                      )}
                      {isFavorited && (
                        <div style={{ marginTop: 14, background: "#fff0f0", borderRadius: 12, padding: "10px", fontSize: 13, color: "#c0392b", fontFamily: "sans-serif", textAlign: "center", border: "1.5px solid #f5c0c0" }}>
                          ❤️ 즐겨찾기 등록됨 — 다음 식단 생성 시 가끔 다시 추천돼요
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <div style={{ textAlign: "center", padding: "14px 16px", fontSize: 13, color: "#888", fontFamily: "sans-serif", lineHeight: 1.8, background: "#f0ede7", borderRadius: 12, marginTop: 8, border: "1px solid #e4ddd4" }}>
              ⚕️ 이 식단은 참고용입니다<br />담당 의사 및 영양사의 지도를 함께 따르세요
            </div>
          </div>
        )}

        {!loading && !currentDiet && !error && (
          <div style={{ background: "#fff", borderRadius: 20, padding: "70px 24px", textAlign: "center", border: "1px solid #e4ddd4" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🌿</div>
            <p style={{ color: "#aaa", fontSize: 15, fontFamily: "sans-serif" }}>오늘의 식단을 불러오는 중입니다...</p>
          </div>
        )}
      </div>
    </div>
  );
}
