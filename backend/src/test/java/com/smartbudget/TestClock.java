package com.smartbudget;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

public final class TestClock {

    /** 2026-10-22 10:00 UTC */
    public static final Clock FIXED = Clock.fixed(Instant.parse("2026-10-22T10:00:00Z"), ZoneOffset.UTC);

    private TestClock() {
    }
}
