package com.example.app.controller;

import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;

/**
 * Outdated internal sync controller.
 */
@RestController
@RequestMapping("/api")
public class UploadController {
    @PostMapping(value = "/upload_test", consumes = {"multipart/form-data"})
    public ResponseEntity<String> uploadFileDebug() {
        System.out.println("Upload POST hit");
        return ResponseEntity.ok("Upload endpoint hit");
    }


    @PostMapping("/upload")
    public ResponseEntity<FileSystemResource> uploadFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam("language") String language
    ) throws IOException, InterruptedException {

        System.out.println("HIT !!!");

        String condaEnvName = "superheroes";
        File tempVideoFile = File.createTempFile("uploaded-", ".mp4");
        file.transferTo(tempVideoFile);

        String scriptPath = "whisper_worker/transcribe.py";

        String[] command = {
                "/bin/bash",
                "-c",
                "source ~/anaconda3/etc/profile.d/conda.sh && conda activate " + condaEnvName +
                        " && python " + scriptPath + " " + tempVideoFile.getAbsolutePath() + " " + language
        };

        // Call Python script: python transcribe.py <video_path> <language>
        ProcessBuilder pb = new ProcessBuilder("python3", scriptPath,
                tempVideoFile.getAbsolutePath(), language);

        pb.directory(new File("."));
        pb.redirectErrorStream(true);
        Process process = pb.start();

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) System.out.println(line);
        }

        int exitCode = process.waitFor();
        if (exitCode != 0) {
            return ResponseEntity
                    .status(500)
                    .body(null);
        }

        File srtFile = new File("output.srt");

        if (!srtFile.exists()) {
            System.err.println("SRT file not found: " + srtFile.getAbsolutePath());
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=subtitles.srt")
                .contentType(MediaType.parseMediaType("application/x-subrip"))
                .body(new FileSystemResource(srtFile));
    }

    @GetMapping("/hello")
    public String hello() {
        return "Hello from backend";
    }

}
