package com.smartbudget.drive;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartbudget.TestClock;
import com.smartbudget.common.ApiException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class GoogleDriveStorageTest {

    private static final LocalDate DATE = LocalDate.of(2026, 10, 23);
    private static final byte[] PDF = "%PDF-1.4 receipt".getBytes(StandardCharsets.UTF_8);

    private MockRestServiceServer server;
    private RestClient client;
    private GoogleDriveStorage storage;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        client = builder.build();
        storage = new GoogleDriveStorage(new DriveProperties("cid", "secret", "refresh", "root-id"), client,
                new ObjectMapper(), TestClock.FIXED);
    }

    private void expectToken() {
        server.expect(requestTo(GoogleDriveStorage.TOKEN_URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().string(containsString("grant_type=refresh_token")))
                .andExpect(content().string(containsString("refresh_token=refresh")))
                .andRespond(withSuccess("{\"access_token\":\"tok\",\"expires_in\":3600}", MediaType.APPLICATION_JSON));
    }

    private void expectFolderFound(String id) {
        server.expect(requestTo(startsWith(GoogleDriveStorage.FILES_URL + "?q=")))
                .andExpect(method(HttpMethod.GET))
                .andExpect(header("Authorization", "Bearer tok"))
                .andRespond(withSuccess("{\"files\":[{\"id\":\"" + id + "\"}]}", MediaType.APPLICATION_JSON));
    }

    private void expectFolderMissingThenCreated(String id) {
        server.expect(requestTo(startsWith(GoogleDriveStorage.FILES_URL + "?q=")))
                .andRespond(withSuccess("{\"files\":[]}", MediaType.APPLICATION_JSON));
        server.expect(requestTo(GoogleDriveStorage.FILES_URL + "?fields=id"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().string(containsString(GoogleDriveStorage.FOLDER_MIME)))
                .andRespond(withSuccess("{\"id\":\"" + id + "\"}", MediaType.APPLICATION_JSON));
    }

    private void expectUpload() {
        server.expect(requestTo(startsWith(GoogleDriveStorage.UPLOAD_URL)))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Authorization", "Bearer tok"))
                .andExpect(header("Content-Type", startsWith("multipart/related;")))
                .andExpect(header("Content-Type", containsString("boundary=sb-")))
                .andExpect(content().string(containsString("\"parents\":[\"month-id\"]")))
                .andExpect(content().string(containsString("\"name\":\"bon.pdf\"")))
                .andExpect(content().string(containsString("application/pdf")))
                .andExpect(content().string(containsString("%PDF-1.4 receipt")))
                .andRespond(withSuccess("{\"id\":\"file-1\",\"name\":\"bon.pdf\",\"webViewLink\":\"https://drive/x\"}",
                        MediaType.APPLICATION_JSON));
    }

    @Test
    void createsMissingYearFolderThenUploadsIntoTheMonthFolder() {
        expectToken();
        expectFolderMissingThenCreated("year-id");
        expectFolderFound("month-id");
        expectUpload();

        DriveFile file = storage.upload("bon.pdf", "application/pdf", PDF, DATE);

        assertThat(file).isEqualTo(new DriveFile("file-1", "bon.pdf", "https://drive/x"));
        server.verify();
    }

    @Test
    void createsTheDefaultRootFolderWhenNoFolderIdIsConfigured() {
        GoogleDriveStorage withoutRoot = new GoogleDriveStorage(new DriveProperties("cid", "secret", "refresh", null),
                client, new ObjectMapper(), TestClock.FIXED);
        expectToken();
        expectFolderMissingThenCreated("smartbudget-id");
        expectFolderFound("year-id");
        expectFolderFound("month-id");
        expectUpload();

        assertThat(withoutRoot.isEnabled()).isTrue();
        assertThat(withoutRoot.upload("bon.pdf", "application/pdf", PDF, DATE).id()).isEqualTo("file-1");
        server.verify();
    }

    @Test
    void reusesTheAccessTokenAndKnownFolders() {
        expectToken();
        expectFolderFound("year-id");
        expectFolderFound("month-id");
        expectUpload();
        storage.upload("bon.pdf", "application/pdf", PDF, DATE);

        server.reset();
        expectUpload();
        storage.upload("bon.pdf", "application/pdf", PDF, DATE);

        server.verify();
    }

    @Test
    void rebuildsFoldersOnceWhenACachedFolderWasDeletedInDrive() {
        expectToken();
        expectFolderFound("year-id");
        expectFolderFound("month-id");
        expectUpload();
        storage.upload("bon.pdf", "application/pdf", PDF, DATE);

        server.reset();
        server.expect(requestTo(startsWith(GoogleDriveStorage.UPLOAD_URL)))
                .andRespond(withStatus(HttpStatus.NOT_FOUND));
        expectFolderFound("year-id");
        expectFolderFound("month-id");
        expectUpload();

        assertThat(storage.upload("bon.pdf", "application/pdf", PDF, DATE).id()).isEqualTo("file-1");
        server.verify();
    }

    @Test
    void reportsARevokedRefreshToken() {
        server.expect(requestTo(GoogleDriveStorage.TOKEN_URL))
                .andRespond(withStatus(HttpStatus.BAD_REQUEST).body("{\"error\":\"invalid_grant\"}")
                        .contentType(MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> storage.upload("bon.pdf", "application/pdf", PDF, DATE))
                .isInstanceOfSatisfying(ApiException.class, ex -> {
                    assertThat(ex.getStatus()).isEqualTo(HttpStatus.BAD_GATEWAY);
                    assertThat(ex.getMessage()).contains("GOOGLE_DRIVE_REFRESH_TOKEN").doesNotContain("refresh_token");
                });
    }

    @Test
    void mapsDriveErrorsToControlledStatuses() {
        expectToken();
        expectFolderFound("year-id");
        expectFolderFound("month-id");
        server.expect(requestTo(startsWith(GoogleDriveStorage.UPLOAD_URL)))
                .andRespond(withStatus(HttpStatus.FORBIDDEN).body("{\"error\":{\"errors\":[{\"reason\":\"storageQuotaExceeded\"}]}}")
                        .contentType(MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> storage.upload("bon.pdf", "application/pdf", PDF, DATE))
                .isInstanceOfSatisfying(ApiException.class, ex -> {
                    assertThat(ex.getStatus()).isEqualTo(HttpStatus.BAD_GATEWAY);
                    assertThat(ex.getMessage()).contains("plin");
                });
    }

    @Test
    void trashSendsPatchAndNeverThrows() {
        expectToken();
        server.expect(requestTo(GoogleDriveStorage.FILES_URL + "/file-1?fields=id"))
                .andExpect(method(HttpMethod.PATCH))
                .andExpect(content().string(containsString("\"trashed\":true")))
                .andRespond(withSuccess("{\"id\":\"file-1\"}", MediaType.APPLICATION_JSON));
        storage.trash("file-1");
        server.verify();

        server.reset();
        server.expect(requestTo(startsWith(GoogleDriveStorage.FILES_URL)))
                .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));
        storage.trash("file-2");
    }

    @Test
    void isDisabledWithoutConfigurationAndRefusesToUpload() {
        GoogleDriveStorage disabled = new GoogleDriveStorage(new DriveProperties("", null, "x", "y"),
                RestClient.builder().build(), new ObjectMapper(), TestClock.FIXED);

        assertThat(disabled.isEnabled()).isFalse();
        assertThatThrownBy(() -> disabled.upload("bon.pdf", "application/pdf", PDF, DATE))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
        disabled.trash("anything");
    }
}
