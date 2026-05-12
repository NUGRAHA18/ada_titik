import '../../domain/entities/user_entity.dart';

class UserModel extends UserEntity {
  UserModel({
    required super.uid,
    required super.name,
    required super.email,
    required super.role,
  });
  // Mengubah data dari Firestore (Map) menjadi object UserModel
  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      uid: (json['uid'] ?? json['id'] ?? json['email']).toString(),
      email: json['email'] ?? '',
      name: json['name'] ?? '',
      // role: UserRole.values.byName(json['role'].toString().toLowerCase()),
      role: _parseRole(json['role']?.toString()),
    );
  }

  // Mengubah object UserModel menjadi Map untuk disimpan ke Firestore
  Map<String, dynamic> toJson () {
    return {
      'id': uid,
      'email': email,
      'name': name,
      'role': role.name,
    };
  }

  UserModel copyWith({
  String? email,
  String? name,
  UserRole? role
  }) {
    return UserModel(
      uid: uid,
      email: email ?? this.email,
      name: name ?? this.name,
      role: role ?? this.role,
    );
  }

  static UserRole _parseRole(String? roleString) {
  return UserRole.values.firstWhere(
    (e) => e.name == roleString?.toLowerCase(),
    orElse: () => UserRole.donatur, // Default jika tidak cocok atau null
  );
}
}
