package com.smartbudget.category;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Reduces a bank-statement description to the words that identify the merchant, so that
 * "KAUFLAND 1234 CLUJ-NAPOCA SRL" and "Kaufland 0981 Cluj Napoca" give the same key: no diacritics or punctuation,
 * no words with digits (card, branch, terminal and reference numbers, dates), no legal suffixes or payment noise.
 */
public final class MerchantKey {

    static final int MAX_TOKENS = 4;
    /** Shorter first words ("la", "dr") are too generic to group different keys by. */
    static final int MIN_GROUP_TOKEN = 3;

    private static final Set<String> NOISE = Set.of(
            // legal forms
            "s", "c", "r", "l", "a", "sc", "srl", "sa", "sca", "snc", "pfa", "ii", "if", "impex", "comimpex", "ltd",
            "llc", "inc", "gmbh", "sarl", "spa", "bv", "nv", "plc", "kft",
            // web addresses
            "www", "http", "https", "com", "ro", "net", "eu", "org",
            // payment noise written by banks
            "pos", "epos", "plata", "cumparare", "tranzactie", "comerciant", "card", "nr", "ref", "tid", "mid", "rrn",
            "terminal", "autorizare", "valoare", "data", "op", "ordin", "incasare", "contactless", "online", "visa",
            "mastercard", "maestro", "ron", "eur", "usd",
            // connecting words
            "la", "in", "de", "din", "si", "pe", "cu", "the", "of", "and");

    private MerchantKey() {
    }

    /** Up to {@link #MAX_TOKENS} identifying words; empty when the description has none (only codes or noise). */
    public static List<String> tokens(String description) {
        if (description == null) {
            return List.of();
        }
        String plain = Normalizer.normalize(description, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT);
        List<String> tokens = new ArrayList<>();
        for (String word : plain.split("[^a-z0-9]+")) {
            if (word.isEmpty() || word.chars().anyMatch(Character::isDigit) || NOISE.contains(word)) {
                continue;
            }
            tokens.add(word);
            if (tokens.size() == MAX_TOKENS) {
                break;
            }
        }
        return tokens;
    }

    /** The key under which the user's choice is remembered; empty when nothing identifies the merchant. */
    public static String of(String description) {
        return String.join(" ", tokens(description));
    }

    /** The first word of a key: keys sharing it ("kaufland cluj", "kaufland brasov") form a group. */
    public static String firstToken(String key) {
        int space = key.indexOf(' ');
        return space < 0 ? key : key.substring(0, space);
    }

    static boolean groupable(String token) {
        return token.length() >= MIN_GROUP_TOKEN;
    }
}
