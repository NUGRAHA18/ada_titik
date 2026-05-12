import 'package:dio/dio.dart';
import '../../domain/entities/user_entity.dart';
import '../models/user_model.dart';


abstract class AuthRemoteDataSource {
  Future<UserModel> signUpWithEmail({
    required String email,
    required String password,
    required String name,
    required UserRole role,
  });
}

class AuthRemoteDataSourceImpl implements AuthRemoteDataSource {
  final Dio client;

  AuthRemoteDataSourceImpl({
    required this.client
  });

  @override
  Future<UserModel> signUpWithEmail({
    required String name,
    required String email,
    required String password,
    required UserRole role,
  }) async {
    try {
      final response = await client.post(
        'auth/register',
        data: {
          'email': email,
          'password': password,
          'name': name,
          'role': role.name,
        },
      );

      if (response.statusCode == 201) {
        final String generatedId = response.data['userId'].toString();
        return UserModel(
          uid: generatedId,
          name: name,
          email: email,
          role: role,
        );
      } else {
        throw Exception('Gagal registrasi: ${response.data['error']}');
      }
    } on DioException catch (e) {
      // Menangkap error spesifik dari backend (seperti 409 Email Terdaftar)
      final errorMessage = e.response?.data['error'] ?? 'Terjadi kesalahan jaringan';
      throw Exception(errorMessage);
    } catch (e) {
      throw Exception('Error: $e');
    }
  }
} 