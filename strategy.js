// Stratégie de l'IA : réécrite librement par le « cerveau » (voir BRAIN.md).
// Ce fichier ne peut pas modifier les règles du jeu (frais, glissement, seuil de survie, mort).
// EURGBP et EURCHF coupés par défaut : une seule lecture Yahoo (1 crédit Firecrawl) par créneau de 15 min.
module.exports = { params: {}, models: [], universe: { on: [], off: ['EURGBP=X', 'EURCHF=X'], add: [] }, notes: [] }
