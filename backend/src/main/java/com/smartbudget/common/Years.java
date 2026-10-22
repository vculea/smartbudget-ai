package com.smartbudget.common;

/** Validation of the optional {@code year} parameter used by the yearly views. */
public final class Years {

    public static final int MIN = 2000;
    public static final int MAX = 2100;

    private Years() {
    }

    public static int require(int year) {
        if (year < MIN || year > MAX) {
            throw ApiException.badRequest("Parametrul year trebuie să fie între " + MIN + " și " + MAX + ".");
        }
        return year;
    }

    /** At most one of month / year may be provided. */
    public static void requireSingleSelector(Object month, Integer year) {
        if (month != null && year != null) {
            throw ApiException.badRequest("Folosește fie month, fie year, nu ambele.");
        }
    }
}
