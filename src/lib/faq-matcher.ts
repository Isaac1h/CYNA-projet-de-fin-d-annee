import { FAQ, type FaqEntry } from '@/data/faq';

/**
 * Matching FAQ sans IA :
 *   - on normalise (lowercase + suppression des diacritiques),
 *   - on tokenize sur les non-alphanumériques,
 *   - on filtre les stopwords FR/EN ultra-courants pour ne pas tirer
 *     un faux positif sur "comment" / "the",
 *   - pour chaque entrée FAQ on combine deux recalls :
 *       recallKw = intersection / |keywords de l'entrée|
 *       recallTk = intersection / |tokens utilisateur|
 *     score = 0.3 * recallKw + 0.7 * recallTk
 *     → on favorise nettement le recall côté utilisateur : ses mots
 *       sont peu nombreux et discriminants ("soc", "rgpd", "2fa"),
 *       alors que les listes de mots-clés sont volontairement larges
 *       et diluent recallKw. Un poids égal rejetait trop d'inputs
 *       courts pourtant clairement scopés.
 *   - en dessous de MATCH_THRESHOLD, on rend null → le widget escalade
 *     vers le support sans halluciner de réponse.
 *
 * Validé sur 12 cas (cf. smoke-test) : "qu'est-ce qu'un SOC", "comment
 * activer la 2fa", "vos prix" matchent ; "pizza", "météo demain", "où
 * sont vos bureaux" → null (pas d'intersection lexicale du tout).
 */

const STOPWORDS: ReadonlySet<string> = new Set([
  // FR — articles, pronoms, mots interrogatifs, prépositions courantes
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'au', 'aux',
  'et', 'ou', 'est', 'sont', 'que', 'qui', 'quoi', 'comment', 'pourquoi',
  'quand', 'ou', 'quel', 'quelle', 'quels', 'quelles',
  'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles',
  'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses',
  'notre', 'votre', 'leur', 'leurs',
  'ce', 'cet', 'cette', 'ces', 'pour', 'avec', 'sans', 'dans', 'par',
  'mais', 'donc', 'car', 'en', 'ne', 'pas', 'plus', 'tres', 'tres',
  'si', 'oui', 'non', 'aussi', 'meme', 'tout', 'tous', 'toute', 'toutes',
  'fait', 'faire', 'avoir', 'etre',
  // EN
  'the', 'a', 'an', 'is', 'are', 'of', 'and', 'or', 'to', 'in', 'on',
  'for', 'with', 'do', 'does', 'how', 'what', 'why', 'when', 'where',
  'can', 'should', 'would', 'could', 'i', 'you', 'we', 'they', 'it',
  'my', 'your', 'our', 'their', 'this', 'that', 'these', 'those',
]);

function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function tokenize(s: string): Set<string> {
  const out = new Set<string>();
  for (const raw of normalize(s).split(/[^a-z0-9]+/)) {
    if (raw.length >= 2 && !STOPWORDS.has(raw)) out.add(raw);
  }
  return out;
}

export type FaqMatch = { entry: FaqEntry; score: number } | null;

export const MATCH_THRESHOLD = 0.25;

export function matchFaq(input: string): FaqMatch {
  const tokens = tokenize(input);
  if (tokens.size === 0) return null;

  let best: { entry: FaqEntry; score: number } | null = null;
  for (const entry of FAQ) {
    const kw = new Set(entry.keywords.map(normalize));
    let inter = 0;
    for (const t of tokens) if (kw.has(t)) inter += 1;
    if (inter === 0) continue;

    const recallKeywords = inter / kw.size;
    const recallTokens = inter / tokens.size;
    const score = 0.3 * recallKeywords + 0.7 * recallTokens;

    if (!best || score > best.score) best = { entry, score };
  }

  if (!best || best.score < MATCH_THRESHOLD) return null;
  return best;
}
