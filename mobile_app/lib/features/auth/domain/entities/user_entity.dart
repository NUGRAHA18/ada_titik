enum UserRole{
  komunitas,
  donatur
}

class UserEntity {
  final String uid;
  final String name;
  final String email;
  final UserRole role;

  UserEntity({
    required this.uid,
    required this.name,
    required this.email,
    required this.role,
  });
}