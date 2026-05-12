import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class DioClient {
  final FlutterSecureStorage storage;
  late final Dio _dio; // Gunakan variabel private

  DioClient(this.storage) {
    _dio = _initDio(); // Inisialisasi sekali saja saat class dibuat
  }

  Dio _initDio() {
    final dio = Dio(
      BaseOptions(
        baseUrl: 'https://adatitik-development.up.railway.app/api/',
        connectTimeout: const Duration(seconds: 45),
        receiveTimeout: const Duration(seconds: 45),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    // Menambahkan Interceptor (Mirip Axios)
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await storage.read(key: 'token');
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onError: (DioException e, handler) {
          if (e.response?.statusCode == 401) {
            // dsfvfdg
          }
          return handler.next(e);
        },
      ),
    );

    // Logger untuk melihat JSON di terminal (Sangat berguna pas koding Django)
    dio.interceptors.add(LogInterceptor(
      requestBody: true,
      responseBody: true,
      logPrint: (object) => print(object), // Ini akan muncul di terminal
    ));

    return dio;
  }
  Dio get instance => _dio;
}