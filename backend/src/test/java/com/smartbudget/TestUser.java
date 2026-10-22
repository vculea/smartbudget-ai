package com.smartbudget;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.smartbudget.auth.CurrentUser;

public final class TestUser {

    public static final String ID = "user-1";

    /** A {@link CurrentUser} that always resolves to {@link #ID}. */
    public static CurrentUser current() {
        CurrentUser currentUser = mock(CurrentUser.class);
        when(currentUser.id()).thenReturn(ID);
        return currentUser;
    }

    private TestUser() {
    }
}
