import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

import '../../../../core/widgets/custom_text_field.dart';
import '../../../../core/widgets/primary_button.dart';
import '../widgets/role_card.dart';
import '../widgets/auth_stepper.dart';

import 'package:mobile_app/features/auth/domain/entities/user_entity.dart';
import 'package:mobile_app/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:mobile_app/features/auth/presentation/bloc/auth_event.dart';
import 'package:mobile_app/features/auth/presentation/bloc/auth_state.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final PageController _pageController = PageController();
  int _currentStep = 1;

  UserRole _selectedRole = UserRole.donatur; 
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final TextEditingController _nameController = TextEditingController();

  void _nextPage() {
    if (_currentStep == 1) {
      // Validasi Step 1: Pastikan email, password, dan nama tidak kosong
      final email = _emailController.text.trim(); // Sanitization: hapus spasi
      final password = _passwordController.text;
      final name = _nameController.text.trim();

      // Regex Email Validation
      final emailRegex = RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$');

      if (name.isEmpty ||email.isEmpty || password.isEmpty) {
        _showErrorSnackBar("nama ,email, password tidak boleh kosong.");
        return;
      }

      if (!emailRegex.hasMatch(email)) {
        _showErrorSnackBar("Format email tidak valid.");
        return;
      }

      if (password.length < 8) {
        _showErrorSnackBar("Password minimal harus 8 karakter.");
        return;
      }
      context.read<AuthBloc>().add(
      AuthRegisterStepOneSubmitted( // Gunakan event update data yang tadi kita bahas
        email: _emailController.text.trim(),
        password: _passwordController.text,
        name: _nameController.text.trim(),
      ),
    );

    
    _pageController.nextPage(
        duration: const Duration(milliseconds: 500),
        curve: Curves.fastOutSlowIn,
      );
      setState(() => _currentStep++);
    }
  }

    void _showErrorSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.redAccent,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.onSurfaceVariant),
          onPressed: (){
            if (_currentStep > 1) {
              // 1. Geser PageView ke halaman sebelumnya
              _pageController.previousPage(
                duration: const Duration(milliseconds: 500),
                curve: Curves.fastOutSlowIn,
              );
              // 2. Update state indikator step
              setState(() => _currentStep--);
            } else {
              // 3. Jika sudah di Step 1, baru kembali ke halaman Login
              Navigator.pop(context);
            }
          },
        ),
        title: const Text(
          "AdaTitik",
          style: TextStyle(
            fontStyle: FontStyle.italic,
            fontWeight: FontWeight.bold,
            color: AppColors.primary,
          ),
        ),
        centerTitle: true,
      ),
      body: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24.0),
        child: Column(
          children: [
            const SizedBox(height: 20),
            // Custom Stepper (Langkah 1 dari 3)
            AuthStepper(
            currentStep: _currentStep, 
            totalSteps: 2,
            ),
            const SizedBox(height: 32),

            Expanded(
              child: PageView(
                controller: _pageController,
                physics: const NeverScrollableScrollPhysics(), // User harus tekan tombol 'Lanjut'
                children: [
                  _buildStepOne(),
                  _buildStepTwo()
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStepOne() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text("Buat Akun Baru", style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold)),
        const Text("Mulai langkahmu untuk membantu sesama.", style: TextStyle(color: AppColors.onSurfaceVariant, fontSize: 16)),
        const SizedBox(height: 32),
        
        // Input Email (Gunakan Shared Widget yang sudah kamu buat nanti)
        CustomTextField(label: "Email", hint: "nama@email.com", icon: Icons.mail_outline, controller: _emailController),
        
        const SizedBox(height: 20),
        
        CustomTextField(label: "Password", hint: "Min. 8 karakter", icon: Icons.lock_outline, isPassword: true, controller: _passwordController),
        
        const SizedBox(height: 20),

        CustomTextField(label: "Nama Lengkap", hint: "John Doe", icon: Icons.person_outline, controller: _nameController),
        
        const Spacer(),
        PrimaryButton(text: "Lanjut", onPressed: _nextPage),
        const SizedBox(height: 40),
      ],
    );
  }
  
  Widget _buildStepTwo() {
  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      // 1. Header Section
      const Center(
        child: Column(
          children: [
            Text(
              "Pilih Peran Anda",
              style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 8),
            Text(
              "Sesuaikan fungsi akun dengan kebutuhan Anda.",
              style: TextStyle(color: AppColors.onSurfaceVariant, fontSize: 16),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
      const SizedBox(height: 32),

      // 2. Role Selection Section
      RoleCard(
        id: UserRole.donatur,
        title: "Donatur",
        description: "Saya ingin mencari titik kebutuhan untuk menyalurkan bantuan.",
        icon: Icons.favorite,
        isSelected: _selectedRole == UserRole.donatur,
        onTap: () => setState(() => _selectedRole = UserRole.donatur),
      ),
      const SizedBox(height: 16),
      RoleCard(
        id: UserRole.komunitas,
        title: "Instansi / Komunitas",
        description: "Saya mewakili organisasi untuk mengelola titik bantuan.",
        icon: Icons.corporate_fare,
        isSelected: _selectedRole == UserRole.komunitas,
        onTap: () => setState(() => _selectedRole = UserRole.komunitas),
      ),

      const SizedBox(height: 24),

      const Spacer(),

      // 4. Action Section (Button dengan Bloc Integration)
      BlocBuilder<AuthBloc, AuthState>(
        builder: (context, state) {
          return PrimaryButton(
            text: "Daftar & Kirim Verifikasi",
            icon: Icons.send,
            isLoading: state.status == AuthStatus.loading, // Reaktif terhadap state loading
            onPressed: () {
              context.read<AuthBloc>().add(
                    AuthRegisterFinalSubmitted(
                  role: _selectedRole
                )
              );
            },
          );
        },
      ),

      const SizedBox(height: 12),
      const Center(
        child: Text(
          "Dengan melanjutkan, Anda menyetujui Syarat & Ketentuan.",
          style: TextStyle(fontSize: 11, color: AppColors.onSurfaceVariant),
        ),
      ),
      const SizedBox(height: 20),
    ],
  );
 }
}