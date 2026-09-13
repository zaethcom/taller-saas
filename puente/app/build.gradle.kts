plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

/**
 * De qué commit salió este APK. La compilación de CI lo pasa por
 * entorno; en local queda "local".
 *
 * Existe por un problema real de campo: se instaló un APK nuevo en el
 * equipo de la sede, el viejo siguió puesto, y desde la pantalla no
 * había forma de notarlo -- se perdió media hora buscando en el sitio
 * equivocado. Ahora la versión se ve en la cabecera de la app.
 */
val revisionPuente = (System.getenv("PUENTE_REVISION") ?: "local").take(7)

/**
 * Android solo trata un APK como actualización si el versionCode sube.
 * En CI es el número de ejecución del workflow, que siempre crece.
 */
val codigoVersionPuente = (System.getenv("PUENTE_VERSION_CODE") ?: "1").toInt()

android {
    namespace = "com.zaethcom.puente"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.zaethcom.puente"
        // 26 es el mismo piso que smart-food-label. BlissOS reporta bastante más.
        minSdk = 26
        targetSdk = 34
        versionCode = codigoVersionPuente
        versionName = "0.1.0-$revisionPuente"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }

    buildFeatures { compose = true }
    composeOptions { kotlinCompilerExtensionVersion = "1.5.14" }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.06.00")
    implementation(composeBom)

    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.4")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.4")
    implementation("androidx.activity:activity-compose:1.9.1")

    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-core")

    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")

    testImplementation("junit:junit:4.13.2")
    // org.json viene con Android pero en pruebas unitarias es un stub que lanza
    // "not mocked". Esta es la implementación real, solo para el classpath de test.
    testImplementation("org.json:json:20240303")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.1")
}
