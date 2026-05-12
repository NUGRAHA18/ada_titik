import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

class AuthStepper extends StatelessWidget {
  final int currentStep;
  final int totalSteps;

  const AuthStepper({super.key, required this.currentStep, required this.totalSteps});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: List.generate(totalSteps, (index) {
            return Expanded(
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                height: 6,
                margin: EdgeInsets.only(right: index == totalSteps - 1 ? 0 : 8),
                decoration: BoxDecoration(
                  color: index < currentStep ? AppColors.primary : AppColors.surfaceContainerHigh,
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            );
          }),
        ),
        const SizedBox(height: 12),
        Text(
          "Langkah $currentStep dari $totalSteps",
          style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.onSurfaceVariant),
        ),
      ],
    );
  }
}