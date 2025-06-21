package com.example.app.controller;

import jakarta.annotation.PostConstruct;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executor;

/**
 * Public API v1.
 */
@RestController
@RequestMapping("/v1/api")
public class SubtitleController {

    private enum State { PROCESSING, COMPLETED, ERROR }

    private static class Job {
        State state = State.PROCESSING;
        Path srtPath;
        String errorMessage;
    }

    private final Map<String, Job> jobs = new ConcurrentHashMap<>();
    private Executor workerPool;

    @PostConstruct
    public void initPool() {
        ThreadPoolTaskExecutor exec = new ThreadPoolTaskExecutor();
        exec.setCorePoolSize(4);
        exec.setMaxPoolSize(8);
        exec.initialize();
        this.workerPool = exec;
    }

    /**
     * Step 1: Submit job. Returns transactionId immediately.
     */
    @PostMapping(value = "/upload", consumes = { "multipart/form-data" })
    public ResponseEntity<Map<String, String>> submitJob(@RequestParam("file") MultipartFile file,
                                                         @RequestParam("language") String language) throws IOException {
        String txId = UUID.randomUUID().toString();
        Job job = new Job();
        jobs.put(txId, job);

        Path videoTmp = Files.createTempFile("video-" + txId, ".mp4");
        file.transferTo(videoTmp);

        workerPool.execute(() -> runWhisper(txId, videoTmp, language));

        return ResponseEntity.accepted().body(Map.of("transactionId", txId));
    }

    /**
     * Step 2: Poll for status.
     */
    @GetMapping("/status/{txId}")
    public ResponseEntity<Map<String, String>> checkStatus(@PathVariable String txId) {
        Job job = jobs.get(txId);
        if (job == null) return ResponseEntity.notFound().build();
        Map<String, String> body = new HashMap<>();
        body.put("state", job.state.name());
        if (job.state == State.ERROR) body.put("error", job.errorMessage);
        return ResponseEntity.ok(body);
    }

    /**
     * Step 3: Download result once status == COMPLETED.
     */
    @GetMapping("/result/{txId}")
    public ResponseEntity<FileSystemResource> downloadResult(@PathVariable String txId) {
        Job job = jobs.get(txId);
        if (job == null || job.state != State.COMPLETED) return ResponseEntity.notFound().build();
        FileSystemResource res = new FileSystemResource(job.srtPath);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + txId + ".srt")
                .contentType(MediaType.parseMediaType("application/x-subrip"))
                .body(res);
    }

    private void runWhisper(String txId, Path videoPath, String language) {
        Job job = jobs.get(txId);
        if (job == null) return;

        Path whisperWorkerDir = Paths.get("whisper_worker");
        Path script = whisperWorkerDir.resolve("transcribe.py");

        try {
            Path srtOut = Files.createTempFile("subs-" + txId, ".srt");
            ProcessBuilder pb = new ProcessBuilder(
                    "python3", script.getFileName().toString(), videoPath.toString(), language);

            pb.directory(whisperWorkerDir.toFile());
            pb.redirectErrorStream(true);
            Process p = pb.start();
            logProcessOutput(p.getInputStream());
            int code = p.waitFor();

            if (code != 0) {
                throw new IllegalStateException("Whisper exited with non-zero code: " + code + ". Check console for Python script errors.");
            }

            Path generatedSrtFile = whisperWorkerDir.resolve("output.srt");
            Files.move(generatedSrtFile, srtOut, StandardCopyOption.REPLACE_EXISTING);
            job.srtPath = srtOut;
            job.state = State.COMPLETED;

        } catch (Exception ex) {
            System.err.println("Error during Whisper transcription for transaction ID " + txId + ": " + ex.getMessage());
            ex.printStackTrace();
            job.state = State.ERROR;
            job.errorMessage = ex.getMessage();
        } finally {
            try {
                if (videoPath != null) {
                    Files.deleteIfExists(videoPath);
                }
            } catch (IOException e) {
                System.err.println("Error cleaning up temporary video file: " + e.getMessage());
            }
        }
    }

    private void logProcessOutput(InputStream in) {
        new Thread(() -> {
            new BufferedReader(new InputStreamReader(in)).lines().forEach(System.out::println);
        }).start();
    }
}