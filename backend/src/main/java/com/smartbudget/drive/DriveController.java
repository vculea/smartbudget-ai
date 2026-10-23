package com.smartbudget.drive;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/drive")
@Tag(name = "Google Drive")
public class DriveController {

    private final DriveStorage storage;

    public DriveController(DriveStorage storage) {
        this.storage = storage;
    }

    @GetMapping("/status")
    @Operation(summary = "Is saving receipts to Google Drive configured?",
            description = "enabled=false when the GOOGLE_DRIVE_* environment variables are not set.")
    public DriveStatus status() {
        return new DriveStatus(storage.isEnabled());
    }

    public record DriveStatus(boolean enabled) {
    }
}
