package com.smartbudget.category;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class MerchantKeyTest {

    @Test
    void keepsOnlyTheWordsThatIdentifyTheMerchant() {
        assertThat(MerchantKey.of("KAUFLAND 1234 CLUJ-NAPOCA SRL")).isEqualTo("kaufland cluj napoca");
        assertThat(MerchantKey.of("Plata la POS MEGA IMAGE 0123 TID:998877")).isEqualTo("mega image");
        assertThat(MerchantKey.of("www.eMAG.ro")).isEqualTo("emag");
        assertThat(MerchantKey.of("S.C. Farmacia Tei S.R.L.")).isEqualTo("farmacia tei");
    }

    @Test
    void ignoresDiacriticsAndCase() {
        assertThat(MerchantKey.of("Brutăria Ștefănești")).isEqualTo(MerchantKey.of("BRUTARIA STEFANESTI"));
    }

    @Test
    void keepsShortNamesLikeHAndM() {
        assertThat(MerchantKey.of("H&M 123")).isEqualTo("h m");
    }

    @Test
    void isEmptyWhenOnlyCodesAndNoiseRemain() {
        assertThat(MerchantKey.of("POS 123456 RON 45,10")).isEmpty();
        assertThat(MerchantKey.of(null)).isEmpty();
    }

    @Test
    void limitsTheNumberOfWords() {
        assertThat(MerchantKey.tokens("unu doi trei patru cinci sase")).isEqualTo(List.of("unu", "doi", "trei", "patru"));
    }

    @Test
    void firstTokenGroupsKeysOfTheSameMerchant() {
        assertThat(MerchantKey.firstToken("kaufland cluj napoca")).isEqualTo("kaufland");
        assertThat(MerchantKey.firstToken("omv")).isEqualTo("omv");
        assertThat(MerchantKey.groupable("omv")).isTrue();
        assertThat(MerchantKey.groupable("h")).isFalse();
    }
}
