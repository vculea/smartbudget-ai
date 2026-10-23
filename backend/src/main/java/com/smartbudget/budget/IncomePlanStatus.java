package com.smartbudget.budget;

/** REACHED: received at least the expected amount; BELOW: the period ended without it; PENDING: still running. */
public enum IncomePlanStatus {
    PENDING,
    REACHED,
    BELOW
}
