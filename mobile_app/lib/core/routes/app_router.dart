// core/routes/app_router.dart
import 'package:go_router/go_router.dart';
import 'dart:async';
import 'package:flutter/material.dart';
import '../../features/auth/presentation/bloc/auth_bloc.dart';
import '../../features/auth/presentation/bloc/auth_state.dart';
import '../../features/auth/presentation/pages/register_screen.dart';

// Stream listener untuk memberitahu GoRouter jika ada perubahan state di BLoC
class GoRouterRefreshStream extends ChangeNotifier {
  late final StreamSubscription<dynamic> _subscription;

  GoRouterRefreshStream(Stream<dynamic> stream) {
    notifyListeners();
    _subscription = stream.asBroadcastStream().listen((_) => notifyListeners());
  }

  @override
  void dispose() {
    _subscription.cancel();
    super.dispose();
  }
}

// core/routes/app_router.dart

class AppRouter {
  final AuthBloc authBloc;

  AppRouter(this.authBloc);

  late final router = GoRouter(
    initialLocation: '/register',
    debugLogDiagnostics: true,
    refreshListenable: GoRouterRefreshStream(authBloc.stream),
    
    redirect: (context, state) {
      final authState = authBloc.state;
      final status = authState.status;

      final String currentLocation = state.matchedLocation;
      final bool isLoggingIn = currentLocation == '/register';
      final bool isRegistering = currentLocation == '/register';

      // 1. Jika SUKSES (Sudah Login/Berhasil Register)
      // Langsung lempar ke /explore jika user masih di area login/register
      if (status == AuthStatus.success) {
        if (isLoggingIn || isRegistering) {
          // return '/explore';
          print('explore');
        }
      }

      // 2. Jika status INITIAL atau FAILURE (Belum Login / Gagal)
      if (status == AuthStatus.initial || status == AuthStatus.failure) {
        
        // IZINKAN user tetap di halaman login atau register
        if (isLoggingIn || isRegistering) {
          return null;
        }

        // Jika mencoba akses halaman internal (seperti /explore) tanpa login, paksa ke /login
        return '/register';
      }

      return null;
    },

    routes: [
      GoRoute(
        path: '/register',
        name: 'register',
        builder: (context, state) => const RegisterScreen(),
      ),
    ],

    errorBuilder: (context, state) => Scaffold(
      body: Center(child: Text('Halaman tidak ditemukan: ${state.error}')),
    ),
  );
}