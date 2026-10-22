package com.smartbudget.auth;

public record UserResponse(String id, String email, String name, String pictureUrl) {

    static UserResponse from(User user) {
        return new UserResponse(user.getId(), user.getEmail(), user.getName(), user.getPictureUrl());
    }
}
