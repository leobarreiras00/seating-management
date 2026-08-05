# ==========================================
# REGRAS DE PROTEÇÃO DO SEATLY (R8/PROGUARD)
# ==========================================

# 1. Proteger a Criptografia (O teu cadeado offline)
-keep class org.mindrot.jbcrypt.** { *; }
-dontwarn org.mindrot.jbcrypt.**

# 2. Proteger as Comunicações em Tempo Real (MQTT)
-keep class org.eclipse.paho.** { *; }
-dontwarn org.eclipse.paho.**
-keep class com.hivemq.client.** { *; }
-dontwarn com.hivemq.client.**

# 3. Proteger a Leitura de QR Codes (ZXing)
-keep class com.journeyapps.barcodescanner.** { *; }
-keep class com.google.zxing.** { *; }
-dontwarn com.google.zxing.**
-dontwarn com.journeyapps.**

# 4. Proteger a Comunicação com a API C# (Retrofit, Gson e OkHttp)
-keep class retrofit2.** { *; }
-dontwarn retrofit2.**
-keep class com.google.gson.** { *; }
-dontwarn com.google.gson.**
-dontwarn sun.misc.Unsafe
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
-dontwarn java.lang.invoke.**

# 5. Proteger as tuas Classes de Dados (Para o Retrofit não se perder)
-keep class com.leonardobarreiras.seatingmanagement.network.** { *; }
-keep class com.leonardobarreiras.seatingmanagement.data.SeatEntity { *; }

# 6. Ignorar avisos inofensivos de Coroutines e Kotlin base
-dontwarn kotlin.**
-dontwarn kotlinx.coroutines.**
-dontwarn org.jetbrains.annotations.**

# 7. Regras Desktop / Java legado
-dontwarn java.awt.**
-dontwarn java.beans.**
-dontwarn javax.swing.**
-dontwarn javax.management.**
-dontwarn javax.naming.**
-dontwarn javax.xml.parsers.**
-dontwarn org.w3c.dom.**
-dontwarn org.xml.sax.**
-dontwarn javax.annotation.**

# 👇 BLOCO 8: A BOMBA NUCLEAR NO NETTY E HIVEMQ 👇
-dontwarn io.netty.**
-dontwarn org.slf4j.**
-dontwarn org.apache.commons.logging.**
-dontwarn org.apache.log4j.**
-dontwarn com.jcraft.jzlib.**
-dontwarn com.ning.compress.**
-dontwarn lzma.sdk.**
-dontwarn net.jpountz.**
-dontwarn org.eclipse.jetty.**
-dontwarn reactor.blockhound.**
-dontwarn java.lang.ClassValue