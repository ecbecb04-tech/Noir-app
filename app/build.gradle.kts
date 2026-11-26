plugins {
    id("com.android.application")
}

android {
    namespace = "app.noir"
    compileSdk = 34

    defaultConfig {
        applicationId = "app.noir"
        minSdk = 23
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
    }

    flavorDimensions += "device"
    productFlavors {
        create("tv") {
            dimension = "device"
            applicationIdSuffix = ".tv"
            resValue("string", "app_name", "NOIR TV")
        }
        create("mobile") {
            dimension = "device"
            applicationIdSuffix = ".mobile"
            resValue("string", "app_name", "NOIR")
        }
    }

    // Assinatura: usa a chave do GitHub Secrets se existir; senão a chave de debug.
    val ksFile = System.getenv("NOIR_KEYSTORE_FILE")
    signingConfigs {
        if (ksFile != null && file(ksFile).exists()) {
            create("release") {
                storeFile = file(ksFile)
                storePassword = System.getenv("NOIR_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("NOIR_KEY_ALIAS")
                keyPassword = System.getenv("NOIR_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("release") ?: signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    lint {
        checkReleaseBuilds = false
        abortOnError = false
    }

    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    val media3 = "1.4.1"
    implementation("androidx.media3:media3-exoplayer:$media3")
    implementation("androidx.media3:media3-exoplayer-hls:$media3")
    implementation("androidx.media3:media3-exoplayer-dash:$media3")
    implementation("androidx.media3:media3-ui:$media3")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.annotation:annotation:1.8.2")
    implementation("androidx.annotation:annotation-experimental:1.4.1")
}
