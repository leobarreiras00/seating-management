# =========================================================
# REGRAS DE OFUSCAÇÃO DEFENSIVAS - SEATLY APP
# =========================================================

# 1. Manter a Classe Base da App (Crucial para o Dagger Hilt)
-keep class com.leonardobarreiras.seatingmanagement.SeatingApplication { *; }

# 2. Segurança e Encriptação (Obrigatório para o PIN e SecureStorage)
-keep class androidx.security.crypto.** { *; }
-keep class com.google.crypto.tink.** { *; }
-dontwarn com.google.errorprone.annotations.**
-dontwarn com.google.crypto.tink.**

# 3. Modelos de Dados (Garantir que a Base de Dados e a API conseguem ler/escrever)
-keepattributes Signature, InnerClasses, EnclosingMethod
-keep class com.leonardobarreiras.seatingmanagement.data.** { *; }
-keep class com.leonardobarreiras.seatingmanagement.network.** { *; }
-keep class com.leonardobarreiras.seatingmanagement.viewmodel.UploadErrorResponse { *; }
-keep class com.leonardobarreiras.seatingmanagement.viewmodel.CsvValidationError { *; }
-keep class com.leonardobarreiras.seatingmanagement.viewmodel.AuthErrorResponse { *; }

# 4. Room Database e Retrofit
-keep class androidx.room.** { *; }
-keep class retrofit2.** { *; }
-keep class com.google.gson.** { *; }

# =========================================================
# 5. O SEGREDO DO MQTT: HiveMQ, RxJava, Netty e JCTools
# =========================================================
# Manter o cliente MQTT intacto
-keep class com.hivemq.client.** { *; }
-dontwarn com.hivemq.client.**

# Manter o RxJava (O motor reativo do HiveMQ)
-keep class io.reactivex.** { *; }
-dontwarn io.reactivex.**

# Manter o Netty INTACTO
-keep class io.netty.** { *; }
-keepnames class io.netty.** { *; }
-keepclassmembers class io.netty.** { *; }
-dontwarn io.netty.**

# Manter o JCTools Intacto
-keep class org.jctools.** { *; }
-dontwarn org.jctools.**

# Regra universal para proteger os campos do "consumerIndex" de serem apagados
-keepclassmembers class * {
    long consumerIndex;
    long producerIndex;
    long pIndex;
    long cIndex;
}

# Ignorar dependências de servidor irrelevantes no Android
-dontwarn reactor.blockhound.**
-dontwarn java.nio.**
-dontwarn sun.misc.**